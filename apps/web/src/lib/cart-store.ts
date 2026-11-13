import type { Product } from "@urbanmag/core";
import type { Cart } from "../components/shop-types";

export const emptyCart: Cart = { items: [], total: 0 };
type Mutation = {
  variantId: string;
  quantity: number;
  method: "POST" | "PATCH";
  product?: Product;
  size?: string;
};
type Pending = Mutation & {
  resolve: (cart: Cart) => void;
  reject: (error: unknown) => void;
};
type Transport = {
  read: () => Promise<Cart>;
  mutate: (operation: Mutation) => Promise<Cart>;
};
export type CartSnapshot = {
  cart: Cart;
  loading: boolean;
  error: boolean;
  pending: boolean;
};

/** A confirmed server base plus an ordered, immediately visible projection. */
export function createCartStore(transport: Transport) {
  let base: Cart | undefined;
  let queue: Pending[] = [];
  let running = false;
  let writing = false;
  let version = 0;
  let read: Promise<Cart> | undefined;
  let snapshot: CartSnapshot = {
    cart: emptyCart,
    loading: true,
    error: false,
    pending: false,
  };
  const listeners = new Set<() => void>();
  function emit(error = false) {
    let cart: Cart = {
      ...(base ?? emptyCart),
      items: [...(base?.items ?? [])],
    };
    for (const op of queue) {
      const current = cart.items.find(
        (item) => item.variantId === op.variantId,
      );
      const quantity =
        op.method === "POST"
          ? (current?.quantity ?? 0) + op.quantity
          : op.quantity;
      cart.items = cart.items.filter((item) => item.variantId !== op.variantId);
      if (quantity > 0 && (current || op.product))
        cart.items.push({
          variantId: op.variantId,
          quantity,
          size: current?.size ?? op.size!,
          product: current?.product ?? op.product!,
        });
    }
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0,
    );
    snapshot = {
      cart,
      loading: !base && queue.length === 0,
      error,
      pending: queue.length > 0,
    };
    listeners.forEach((listener) => listener());
  }
  async function refresh(): Promise<Cart> {
    if (read) return read;
    const started = version;
    read = transport
      .read()
      .then((cart) => {
        if (started === version && !writing) {
          base = cart;
          emit();
        }
        return snapshot.cart;
      })
      .catch((error: unknown) => {
        emit(true);
        throw error;
      })
      .finally(() => {
        read = undefined;
      });
    return read;
  }
  async function pump() {
    if (running) return;
    running = true;
    try {
      if (!base) await refresh();
      while (queue.length) {
        const op = queue[0];
        version++;
        writing = true;
        try {
          base = await transport.mutate(op);
          writing = false;
          version++;
          queue.shift();
          emit();
          op.resolve(snapshot.cart);
        } catch (error) {
          writing = false;
          version++;
          queue.shift();
          emit();
          // A timed-out write may have reached the server. Reconcile before the next write.
          try {
            if (read) await read.catch(() => {});
            await refresh();
          } catch {
            base = undefined;
            emit(true);
          }
          op.reject(error);
          if (!base) throw error;
        }
      }
    } catch (error) {
      const failed = queue;
      queue = [];
      emit(true);
      failed.forEach((op) => op.reject(error));
    } finally {
      running = false;
      emit(snapshot.error);
    }
  }
  function enqueue(operation: Mutation): Promise<Cart> {
    const current = snapshot.cart.items.find(
      (item) => item.variantId === operation.variantId,
    );
    const quantity =
      operation.method === "POST"
        ? (current?.quantity ?? 0) + operation.quantity
        : operation.quantity;
    const product = operation.product ?? current?.product;
    const available = product?.sizes.find(
      (size) => size.id === operation.variantId,
    )?.available;
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      (available !== undefined && quantity > available)
    )
      return Promise.reject(
        Object.assign(new Error("OUT_OF_STOCK"), { code: "OUT_OF_STOCK" }),
      );
    const promise = new Promise<Cart>((resolve, reject) =>
      queue.push({ ...operation, resolve, reject }),
    );
    emit();
    void pump();
    return promise;
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    seed(cart?: Cart) {
      if (cart && !base && !running && !queue.length) {
        base = cart;
        emit();
      }
    },
    refresh,
    add(product: Product, variant: Product["sizes"][number], quantity = 1) {
      return enqueue({
        variantId: variant.id,
        quantity,
        method: "POST",
        product,
        size: variant.size,
      });
    },
    setQuantity(variantId: string, quantity: number) {
      return enqueue({ variantId, quantity, method: "PATCH" });
    },
    async settled(): Promise<Cart> {
      if (!base && !queue.length) await refresh();
      if (queue.length || running)
        await new Promise<void>((resolve) => {
          const stop = this.subscribe(() => {
            if (!queue.length && !running) {
              stop();
              resolve();
            }
          });
        });
      if (!base || snapshot.error) throw new Error("Cart unavailable");
      return snapshot.cart;
    },
  };
}
