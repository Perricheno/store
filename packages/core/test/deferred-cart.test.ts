import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = process.env.CORE_CART_TEST_DATABASE_URL || "";
process.env.PGLITE_DATA_DIR = "memory://";
process.env.APP_ENV = "test";
process.env.APIPAY_MODE = "mock";
process.env.MAIL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const core = await import("../src/index");
const { database } = await import("../src/db");
after(() => core.closeCore());

async function fixture(stock = [10, 10]) {
  await core.initCore();
  const db = await database();
  const id = randomUUID();
  const names = { ru: "Тест", kk: "Сынақ", en: "Test" };
  await db.query(
    "INSERT INTO products(id,slug,category,gender,brand,names,description,price,published) VALUES($1,$1,'t-shirts','unisex','Test',$2,$2,1234,true)",
    [id, names],
  );
  for (const [index, quantity] of stock.entries()) {
    await db.query("INSERT INTO variants(id,product_id,size,color) VALUES($1,$2,$3,'black')", [`${id}_${index}`, id, `S${index}`]);
    await db.query("INSERT INTO inventory(variant_id,branch_id,quantity) VALUES($1,'main',$2)", [`${id}_${index}`, quantity]);
  }
  return (await core.getProduct(id))!;
}
const checkout = (expectedTotal: number) => ({
  email: "deferred@example.test", phone: "+7 701 123 45 67", fulfillment: "pickup",
  expectedTotal, idempotencyKey: randomUUID(), locale: "ru" as const,
});

test("pending size persists as a product row and checkout rejects it before any order or reservation", async () => {
  const product = await fixture();
  const visitor = randomUUID();
  const added = await core.mutateCart(visitor, { productId: product.id, quantity: 2, mode: "add" });
  assert.equal(added.count, 2);
  assert.equal(added.total, 2468);
  assert.equal(added.items[0].variantId, null);
  assert.equal(added.items[0].size, "");
  assert.deepEqual(await core.getCart(visitor), added);
  await assert.rejects(core.createCheckout(visitor, checkout(added.total)), { code: "SIZE_REQUIRED" });
  const db = await database();
  assert.equal((await db.query("SELECT id FROM orders WHERE visitor_id=$1", [visitor])).length, 0);
  assert.equal((await db.query("SELECT reserved FROM inventory WHERE variant_id=$1", [product.sizes[0].id]))[0].reserved, 0);
  assert.equal((await db.query("SELECT id FROM variants WHERE product_id=$1", [product.id])).length, 2);
  const selected = await core.mutateCart(visitor, { productId: product.id, selectVariantId: product.sizes[0].id, quantity: 2, mode: "set" });
  assert.equal(selected.items[0].variantId, product.sizes[0].id);
  const created = await core.createCheckout(visitor, checkout(selected.total));
  assert.equal(created.order.lines[0].variantId, product.sizes[0].id);
  assert.equal(created.order.lines[0].quantity, 2);
  assert.equal((await core.getCart(visitor)).count, 0);
  assert.equal((await db.query("SELECT * FROM cart_pending_sizes WHERE visitor_id=$1", [visitor])).length, 0);
});

test("concurrent pending adds are atomic; resolving and changing size merge duplicate variants", async () => {
  const product = await fixture();
  const visitor = randomUUID();
  await Promise.all(Array.from({ length: 4 }, () => core.mutateCart(visitor, { productId: product.id, quantity: 1, mode: "add" })));
  assert.equal((await core.getCart(visitor)).count, 4);
  await core.updateCart(visitor, product.sizes[0].id, 2);
  let result = await core.mutateCart(visitor, { productId: product.id, selectVariantId: product.sizes[0].id, quantity: 4, mode: "set" });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 6);
  await core.updateCart(visitor, product.sizes[1].id, 1);
  result = await core.mutateCart(visitor, { variantId: product.sizes[0].id, selectVariantId: product.sizes[1].id, quantity: 6, mode: "set" });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].variantId, product.sizes[1].id);
  assert.equal(result.items[0].quantity, 7);
  assert.equal((await core.getCart(randomUUID())).count, 0);
});

test("pending and selected quantities respect actual stock; failed size changes preserve both rows", async () => {
  const product = await fixture([2, 1]);
  const other = await fixture();
  const visitor = randomUUID();
  await core.updateCart(visitor, product.sizes[0].id, 2);
  await core.mutateCart(visitor, { productId: product.id, quantity: 1, mode: "add" });
  const before = await core.getCart(visitor);
  await assert.rejects(core.mutateCart(visitor, { productId: product.id, quantity: 1, mode: "add" }), { code: "OUT_OF_STOCK" });
  await assert.rejects(core.mutateCart(visitor, { productId: product.id, selectVariantId: product.sizes[0].id, quantity: 1, mode: "set" }), { code: "OUT_OF_STOCK" });
  await assert.rejects(core.mutateCart(visitor, { productId: product.id, selectVariantId: other.sizes[0].id, quantity: 1, mode: "set" }), { code: "INVALID_VARIANT" });
  assert.deepEqual(await core.getCart(visitor), before);
  const db = await database();
  await db.query("UPDATE inventory SET quantity=0 WHERE variant_id=$1", [product.sizes[1].id]);
  await assert.rejects(core.mutateCart(visitor, { productId: product.id, selectVariantId: product.sizes[1].id, quantity: 1, mode: "set" }), { code: "OUT_OF_STOCK" });
  const removed = await core.mutateCart(visitor, { productId: product.id, quantity: 0, mode: "set" });
  assert.equal(removed.count, 2);
});

test("only one actual variant is automatically selected; one remaining size still needs a choice", async () => {
  const single = await fixture([2]);
  const multi = await fixture([0, 2]);
  const soldOut = await fixture([0]);
  const visitor = randomUUID();
  const first = await core.mutateCart(visitor, { productId: single.id, quantity: 1, mode: "add" });
  assert.equal(first.items[0].variantId, single.sizes[0].id);
  const second = await core.mutateCart(visitor, { productId: multi.id, quantity: 1, mode: "add" });
  assert.equal(second.items.find((item) => item.product.id === multi.id)?.variantId, null);
  await assert.rejects(core.mutateCart(visitor, { productId: soldOut.id, quantity: 1, mode: "add" }), { code: "OUT_OF_STOCK" });
  await assert.rejects(core.mutateCart(visitor, { productId: multi.id, variantId: multi.sizes[0].id, quantity: 1, mode: "add" }), { code: "VALIDATION" });
  await assert.rejects(core.mutateCart(visitor, { productId: multi.id, quantity: 51, mode: "add" }), { code: "VALIDATION" });
});

test("additive migration can run again without losing legacy selected or pending cart rows", async () => {
  const product = await fixture();
  const visitor = randomUUID();
  await core.updateCart(visitor, product.sizes[0].id, 1);
  await core.mutateCart(visitor, { productId: product.id, quantity: 1, mode: "add" });
  const before = await core.getCart(visitor);
  const { migration } = await import("../src/migration");
  await (await database()).exec(migration);
  assert.deepEqual(await core.getCart(visitor), before);
});

test("size choices move the full locked source despite a stale client quantity and merge without losing units", async () => {
  const product = await fixture();
  const visitor = randomUUID();
  await core.mutateCart(visitor, { productId: product.id, quantity: 3, mode: "add" });
  await core.updateCart(visitor, product.sizes[0].id, 2);
  let result = await core.mutateCart(visitor, {
    productId: product.id, selectVariantId: product.sizes[0].id, quantity: 1, mode: "set",
  });
  assert.equal(result.count, 5);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 5);
  await core.updateCart(visitor, product.sizes[1].id, 1);
  result = await core.mutateCart(visitor, {
    variantId: product.sizes[0].id, selectVariantId: product.sizes[1].id, quantity: 0, mode: "set",
  });
  assert.equal(result.count, 6);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 6);
  assert.equal(result.items[0].variantId, product.sizes[1].id);
  // Selecting the same size is an identity operation, even with stale quantity.
  result = await core.mutateCart(visitor, {
    variantId: product.sizes[1].id, selectVariantId: product.sizes[1].id, quantity: 1, mode: "set",
  });
  assert.equal(result.count, 6);
});
