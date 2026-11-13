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
