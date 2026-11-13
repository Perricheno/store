import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@urbanmag/core";
import { createCartStore } from "../apps/web/src/lib/cart-store";
import type { Cart } from "../apps/web/src/components/shop-types";
const variant = { id: "v", size: "M", color: "black", available: 10 };
const product = { id: "p", price: 100, sizes: [variant] } as Product;
const cart = (quantity = 0): Cart => ({
  items: quantity ? [{ variantId: "v", size: "M", quantity, product }] : [],
  total: quantity * 100,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("add projects immediately while bootstrapping and preserves existing server items", async () => {
  const initial = deferred<Cart>();
  const write = deferred<Cart>();
  let writes = 0;
  const store = createCartStore({
    read: () => initial.promise,
    mutate: () => {
      writes++;
      return write.promise;
    },
  });
  const pending = store.add(product, variant);
  assert.equal(store.getSnapshot().cart.total, 100);
  assert.equal(writes, 0);
  initial.resolve(cart(2));
  await tick();
  assert.equal(store.getSnapshot().cart.total, 300);
  write.resolve(cart(3));
  await pending;
  assert.equal(store.getSnapshot().cart.total, 300);
});

test("serial writes rebase queued increments and absolute quantity; checkout waits", async () => {
  const writes = [deferred<Cart>(), deferred<Cart>(), deferred<Cart>()];
  const operations: string[] = [];
  const store = createCartStore({
    read: async () => cart(),
    mutate: (op) => {
      operations.push(`${op.method}:${op.quantity}`);
      return writes[operations.length - 1].promise;
    },
  });
  store.seed(cart());
  const first = store.add(product, variant);
  const second = store.add(product, variant);
  const third = store.setQuantity("v", 5);
  assert.equal(store.getSnapshot().cart.total, 500);
  assert.deepEqual(operations, ["POST:1"]);
  let settled = false;
  const checkout = store.settled().then((value) => {
    settled = true;
    return value;
  });
  writes[0].resolve(cart(1));
  await first;
  await tick();
  assert.equal(settled, false);
  assert.equal(store.getSnapshot().cart.total, 500);
  writes[1].resolve(cart(2));
  await second;
  await tick();
  writes[2].resolve(cart(5));
  await third;
  assert.equal((await checkout).total, 500);
  assert.deepEqual(operations, ["POST:1", "POST:1", "PATCH:5"]);
});

test("failed write rolls back and reconciles ambiguous server application before next write", async () => {
  const failure = deferred<Cart>();
  const reconciliation = deferred<Cart>();
  let calls = 0;
  const store = createCartStore({
    read: () => reconciliation.promise,
    mutate: async () => {
      if (++calls === 1) return failure.promise;
      return cart(2);
    },
  });
  store.seed(cart());
  const first = store.add(product, variant);
  const rejected = assert.rejects(first, /timeout/);
  const second = store.add(product, variant);
  failure.reject(new Error("timeout"));
  await tick();
  assert.equal(store.getSnapshot().cart.total, 100);
  assert.equal(calls, 1);
  reconciliation.resolve(cart(1));
  await rejected;
  await second;
  assert.equal(store.getSnapshot().cart.total, 200);
});

test("a stale GET cannot overwrite a newer mutation", async () => {
  const stale = deferred<Cart>();
  const store = createCartStore({
    read: () => stale.promise,
    mutate: async () => cart(1),
  });
  store.seed(cart());
  const reading = store.refresh();
  await store.add(product, variant);
  stale.resolve(cart());
  await reading;
  assert.equal(store.getSnapshot().cart.total, 100);
});

test("stock rejection is immediate and failed bootstrap never sends writes", async () => {
  let writes = 0;
  const store = createCartStore({
    read: async () => {
      throw new Error("offline");
    },
    mutate: async () => {
      writes++;
      return cart();
    },
  });
  await assert.rejects(store.add(product, variant, 11), /OUT_OF_STOCK/);
  await assert.rejects(store.add(product, variant), /offline/);
  assert.equal(writes, 0);
  assert.equal(store.getSnapshot().cart.total, 0);
  await assert.rejects(store.settled(), /offline/);
});

const secondVariant = { id: "v2", size: "L", color: "black", available: 10 };
const multiSizeProduct = { ...product, sizes: [variant, secondVariant] };
const pendingCart = (quantity: number): Cart => ({
  items: quantity ? [{ variantId: null, size: "", quantity, product: multiSizeProduct }] : [],
  total: quantity * 100,
});

test("quick add immediately projects a product without inventing a variant; selecting size merges an existing line", async () => {
  const adding = deferred<Cart>();
  const selecting = deferred<Cart>();
  const operations: unknown[] = [];
  const store = createCartStore({
    read: async () => cart(),
    mutate: (op) => {
      operations.push(op);
      return operations.length === 1 ? adding.promise : selecting.promise;
    },
  });
  const existing: Cart = { items: [{ variantId: "v", size: "M", quantity: 2, product: multiSizeProduct }], total: 200 };
  store.seed(existing);
  const add = store.addProduct(multiSizeProduct);
  assert.equal(store.getSnapshot().cart.total, 300);
  assert.equal(store.getSnapshot().cart.items.find((item) => !item.variantId)?.product.id, "p");
  assert.equal(store.getSnapshot().cart.items.find((item) => !item.variantId)?.size, "");
  adding.resolve({ items: [...existing.items, ...pendingCart(1).items], total: 300 });
  await add;
  const select = store.selectSize("p", "v");
  assert.equal(store.getSnapshot().cart.items.length, 1);
  assert.equal(store.getSnapshot().cart.items[0].quantity, 3);
  assert.equal(store.getSnapshot().cart.items[0].variantId, "v");
  selecting.resolve({ items: [{ ...existing.items[0], quantity: 3 }], total: 300 });
  await select;
  assert.equal((operations[0] as { productId: string }).productId, "p");
  assert.equal((operations[0] as { variantId: null }).variantId, null);
  assert.equal((operations[1] as { selectVariantId: string }).selectVariantId, "v");
});

test("pending adds and quantity updates serialize and keep a stable product identity", async () => {
  const writes = [deferred<Cart>(), deferred<Cart>(), deferred<Cart>()];
  let calls = 0;
  const store = createCartStore({ read: async () => cart(), mutate: () => writes[calls++].promise });
  store.seed(cart());
  const first = store.addProduct(multiSizeProduct);
  const second = store.addProduct(multiSizeProduct);
  const third = store.setQuantity("p", 4);
  assert.equal(store.getSnapshot().cart.items.length, 1);
  assert.equal(store.getSnapshot().cart.total, 400);
  writes[0].resolve(pendingCart(1));
  await first;
  writes[1].resolve(pendingCart(2));
  await second;
  writes[2].resolve(pendingCart(4));
  await third;
  assert.equal((await store.settled()).items[0].variantId, null);
  assert.equal(calls, 3);
});

test("one actual variant auto-selects; a multi-size product with one stocked variant stays unresolved", async () => {
  const store = createCartStore({ read: async () => cart(), mutate: async () => cart(1) });
  store.seed(cart());
  const single = store.addProduct(product);
  assert.equal(store.getSnapshot().cart.items[0].variantId, "v");
  await single;
  const onlyStocked = { ...multiSizeProduct, sizes: [{ ...variant, available: 0 }, secondVariant] };
  const pending = deferred<Cart>();
  const other = createCartStore({ read: async () => cart(), mutate: () => pending.promise });
  other.seed(cart());
  const adding = other.addProduct(onlyStocked);
  assert.equal(other.getSnapshot().cart.items[0].variantId, null);
  pending.resolve(pendingCart(1));
  await adding;
});

test("selection failure restores unresolved rows and stock exhaustion never prevents removing them", async () => {
  const initial = pendingCart(1);
  const failure = deferred<Cart>();
  const store = createCartStore({ read: async () => initial, mutate: () => failure.promise });
  store.seed(initial);
  const selecting = store.selectSize("p", "v");
  assert.equal(store.getSnapshot().cart.items[0].variantId, "v");
  const rejected = assert.rejects(selecting, /OUT_OF_STOCK/);
  failure.reject(new Error("OUT_OF_STOCK"));
  await rejected;
  assert.equal(store.getSnapshot().cart.items[0].variantId, null);
  const exhausted = { ...multiSizeProduct, sizes: multiSizeProduct.sizes.map((v) => ({ ...v, available: 0 })) };
  const soldOut = createCartStore({ read: async () => cart(), mutate: async () => cart() });
  soldOut.seed({ items: [{ ...initial.items[0], product: exhausted }], total: 100 });
  await assert.rejects(soldOut.addProduct(exhausted), /OUT_OF_STOCK/);
  await soldOut.setQuantity("p", 0);
  assert.equal(soldOut.getSnapshot().cart.items.length, 0);
});

for (const selected of [false, true]) {
  test(`${selected ? "selected size change" : "pending size choice"} rebases hidden bootstrap quantities before projecting and sending the move`, async () => {
    const initial = deferred<Cart>();
    const added = deferred<Cart>();
    const moved = deferred<Cart>();
    const operations: Array<{ quantity: number; selectVariantId?: string }> = [];
    const source = (quantity: number): Cart => ({
      items: [{ variantId: selected ? "v" : null, size: selected ? "M" : "", quantity, product: multiSizeProduct }],
      total: quantity * 100,
    });
    const targetId = selected ? "v2" : "v";
    const store = createCartStore({
      read: () => initial.promise,
      mutate: (operation) => {
        operations.push(operation);
        return operations.length === 1 ? added.promise : moved.promise;
      },
    });
    const add = selected ? store.add(multiSizeProduct, variant) : store.addProduct(multiSizeProduct);
    const select = store.selectSize(selected ? "v" : "p", targetId);
    assert.equal(store.getSnapshot().cart.items[0].quantity, 1);
    assert.equal(store.getSnapshot().cart.items[0].variantId, targetId);
    // The original quantity was not available when the customer chose the size.
    initial.resolve(source(2));
    await tick();
    assert.equal(store.getSnapshot().cart.items[0].quantity, 3);
    assert.equal(store.getSnapshot().cart.items[0].variantId, targetId);
    added.resolve(source(3));
    await add;
    assert.equal(operations.length, 2);
    assert.equal(operations[1].quantity, 3);
    assert.equal(operations[1].selectVariantId, targetId);
    assert.equal(store.getSnapshot().cart.items[0].quantity, 3);
    moved.resolve({ items: [{ ...source(3).items[0], variantId: targetId, size: selected ? "L" : "M" }], total: 300 });
    await select;
    assert.equal((await store.settled()).items[0].quantity, 3);
  });
}

test("a queued size choice does not remove its existing target when the preceding source add fails", async () => {
  const failed = deferred<Cart>();
  const existing: Cart = { items: [{ variantId: "v", size: "M", quantity: 2, product: multiSizeProduct }], total: 200 };
  let writes = 0;
  const store = createCartStore({ read: async () => existing, mutate: () => { writes++; return failed.promise; } });
  store.seed(existing);
  const add = store.addProduct(multiSizeProduct);
  const select = store.selectSize("p", "v");
  const rejectedAdd = assert.rejects(add, /OUT_OF_STOCK/);
  const rejectedSelect = assert.rejects(select, /CART_CHANGED/);
  failed.reject(new Error("OUT_OF_STOCK"));
  await rejectedAdd;
  await rejectedSelect;
  assert.equal(writes, 1);
  assert.equal(store.getSnapshot().cart.total, 200);
  assert.equal(store.getSnapshot().cart.items[0].quantity, 2);
  assert.equal(store.getSnapshot().cart.items[0].variantId, "v");
});
