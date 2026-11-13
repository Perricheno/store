import type { Product } from "@urbanmag/core";
import type { Cart } from "../components/shop-types";

export const emptyCart: Cart = { items: [], total: 0 };
type Mutation = {
  variantId: string | null;
  productId?: string;
  selectVariantId?: string;
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
      const current = cart.items.find((item) => op.variantId
        ? item.variantId === op.variantId
        : item.variantId === null && item.product.id === op.productId);
      // A size choice moves the current source row, including quantities learned
      // during bootstrap or confirmed by earlier queued writes.
      if (op.selectVariantId && !current) continue;
      const targetId = op.selectVariantId ?? op.variantId;
      const product = current?.product ?? op.product;
      const target = cart.items.find((item) => targetId
        ? item.variantId === targetId
        : item.variantId === null && item.product.id === op.productId);
      const moving = Boolean(op.selectVariantId && op.selectVariantId !== op.variantId);
      const quantity = op.selectVariantId
        ? current!.quantity + (moving ? target?.quantity ?? 0 : 0)
        : op.method === "POST"
          ? (current?.quantity ?? 0) + op.quantity
          : op.quantity;
      cart.items = cart.items.filter((item) => item !== current && (!moving || item !== target));
      if (quantity > 0 && product)
        cart.items.push({
          variantId: targetId,
          quantity,
          size: targetId ? (product.sizes.find((v) => v.id === targetId)?.size ?? op.size ?? "") : "",
          product,
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
          let operation: Mutation = op;
          if (op.selectVariantId) {
            const source = base?.items.find((item) => op.variantId
              ? item.variantId === op.variantId
              : item.variantId === null && item.product.id === op.productId);
            if (!source)
              throw Object.assign(new Error("CART_CHANGED"), { code: "CART_CHANGED" });
            operation = { ...op, quantity: source.quantity };
          }
          base = await transport.mutate(operation);
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
    const current = snapshot.cart.items.find((item) => operation.variantId
      ? item.variantId === operation.variantId
      : item.variantId === null && item.product.id === operation.productId);
    const moving = Boolean(operation.selectVariantId && operation.selectVariantId !== operation.variantId);
    const targetId = operation.selectVariantId ?? operation.variantId;
    const target = snapshot.cart.items.find((item) => targetId
      ? item.variantId === targetId
      : item.variantId === null && item.product.id === operation.productId);
    const quantity = operation.selectVariantId
      ? (current?.quantity ?? 0) + (moving ? target?.quantity ?? 0 : 0)
      : operation.method === "POST"
        ? (current?.quantity ?? 0) + operation.quantity
        : operation.quantity;
    const product = operation.product ?? current?.product;
    const available = targetId
      ? product?.sizes.find((size) => size.id === targetId)?.available
      : product?.sizes.reduce((sum, size) => sum + size.available, 0);
    const others = snapshot.cart.items.filter((item) => item.product.id === product?.id && item !== current && item !== target)
      .reduce((sum, item) => sum + item.quantity, 0);
    const totalAvailable = product?.sizes.reduce((sum, size) => sum + size.available, 0);
    const removing = operation.method === "PATCH" && operation.quantity === 0 && !operation.selectVariantId;
    if (!removing && (!Number.isInteger(quantity) || quantity < 0 || quantity > 50 ||
      (available !== undefined && quantity > available) ||
      (totalAvailable !== undefined && quantity + others > totalAvailable)))
      return Promise.reject(Object.assign(new Error("OUT_OF_STOCK"), { code: "OUT_OF_STOCK" }));
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
    addProduct(product: Product, quantity = 1) {
      const only = product.sizes.length === 1 ? product.sizes[0] : undefined;
      return enqueue({ variantId: only?.id ?? null, productId: only ? undefined : product.id,
        quantity, method: "POST", product, size: only?.size });
    },
    setQuantity(lineKey: string, quantity: number) {
      const item = snapshot.cart.items.find((item) => (item.variantId ?? item.product.id) === lineKey);
      return enqueue({ variantId: item?.variantId ?? (item ? null : lineKey),
        productId: item?.variantId === null ? item.product.id : undefined, quantity, method: "PATCH" });
    },
    selectSize(lineKey: string, selectVariantId: string) {
      const item = snapshot.cart.items.find((item) => (item.variantId ?? item.product.id) === lineKey);
      if (!item) return Promise.reject(new Error("Cart item unavailable"));
      return enqueue({ variantId: item.variantId, productId: item.variantId ? undefined : item.product.id,
        // Size choices carry identity; the pump resolves the current quantity.
        quantity: 0, selectVariantId, method: "PATCH" });
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
