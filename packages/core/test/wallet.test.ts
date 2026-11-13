import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
process.env.DATABASE_URL = process.env.CORE_WALLET_TEST_DATABASE_URL || "";
process.env.PGLITE_DATA_DIR = "memory://";
process.env.APP_ENV = "test";
process.env.APIPAY_MODE = "mock";
const core = await import("../src/index");
const { database } = await import("../src/db");
after(() => core.closeCore());
const buyer = randomUUID(),
  other = randomUUID(),
  staff = randomUUID(),
  temporary = randomUUID();
const email = "wallet-buyer@example.test";
let price: number, variant: string, productId: string;
const visitor = () => `wallet_visitor_${randomUUID().replaceAll("-", "")}`;
const input = (key: string, total = price) => ({
  email,
  phone: "+7 701 123 45 67",
  fulfillment: "pickup",
  expectedTotal: total,
  idempotencyKey: key,
  locale: "ru" as const,
  paymentMethod: "wallet" as const,
});
async function topup(amount: number, key = randomUUID()) {
  const result = await core.createWalletTopup(buyer, {
    amount,
    phone: "+7 701 123 45 67",
    idempotencyKey: key,
  });
  await core.simulateWalletTopup(buyer, result.id);
  return result;
}
const event = (
  id: string,
  amount: number,
  status = "paid",
  suffix = status,
) => ({
  eventId: `test:${id}:${suffix}`,
  topupId: id,
  invoiceId: `mock-${id}`,
  amount,
  environment: "mock",
  status,
});
async function cart() {
  const id = visitor();
  await core.updateCart(id, variant, 1);
  return id;
}
async function balance() {
  return (await core.getWallet(buyer)).balance;
}
async function ledgerCheck() {
  const [s] = await (
    await database()
  ).query(
    "SELECT COALESCE(sum(CASE WHEN kind IN ('topup_credit','order_refund') THEN amount ELSE -amount END),0)::integer AS total FROM wallet_entries WHERE user_id=$1 AND environment='mock'",
    [buyer],
  );
  assert.equal(await balance(), s.total);
}
test("wallet begins at zero, requires exact confirmed customer, and isolates environments", async () => {
  await core.initCore();
  const db = await database();
  for (const [id, mail, role, must] of [
    [buyer, email, "customer", false],
    [other, "wallet-other@example.test", "customer", false],
    [staff, "wallet-staff@example.test", "manager", false],
    [temporary, "wallet-temp@example.test", "customer", true],
  ])
    await db.query(
      "INSERT INTO users(id,email,role,must_change_password) VALUES($1,$2,$3,$4)",
      [id, mail, role, must],
    );
  const product = (await core.getProducts()).find((p) =>
    p.sizes.some((v) => v.available >= 8),
  )!;
  price = product.price;
  variant = product.sizes.find((v) => v.available >= 8)!.id;
  productId = product.id;
  assert.equal(await balance(), 0);
  await assert.rejects(core.getWallet(staff), { code: "UNAUTHORIZED" });
  await assert.rejects(core.getWallet(temporary), {
    code: "PASSWORD_CHANGE_REQUIRED",
  });
  process.env.APIPAY_MODE = "sandbox";
  assert.equal(await balance(), 0);
  assert.equal((await core.getWallet(buyer)).topupAvailable, false);
  await assert.rejects(
    core.createWalletTopup(buyer, {
      amount: 100,
      phone: "+77011234567",
      idempotencyKey: "no-keys-available",
    }),
    { code: "WALLET_UNAVAILABLE" },
  );
  process.env.APIPAY_MODE = "production";
  delete process.env.WALLET_PRODUCTION_ENABLED;
  assert.equal((await core.getWallet(buyer)).topupAvailable, false);
  process.env.APIPAY_MODE = "mock";
});
test("topup idempotency, ownership, verified amount/environment/invoice and paid exactly once", async () => {
  const amount = price * 3,
    key = randomUUID(),
    data = { amount, phone: "+77011234567", idempotencyKey: key };
  const t = await core.createWalletTopup(buyer, data);
  assert.equal((await core.createWalletTopup(buyer, data)).id, t.id);
  await assert.rejects(
    core.createWalletTopup(buyer, { ...data, amount: amount + 1 }),
    { code: "TOPUP_CHANGED" },
  );
  await assert.rejects(core.simulateWalletTopup(other, t.id), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    core.processWalletTopupEvent({
      ...event(t.id, amount),
      amount: amount + 1,
    }),
    { code: "PAYMENT_MISMATCH" },
  );
  await assert.rejects(
    core.processWalletTopupEvent({
      ...event(t.id, amount),
      environment: "production",
    }),
    { code: "PAYMENT_MISMATCH" },
  );
  await core.recordWalletTopupInvoice(t.id, {
    invoiceId: `mock-${t.id}`,
    amount,
    environment: "mock",
  });
  await assert.rejects(
    core.processWalletTopupEvent({
      ...event(t.id, amount),
      invoiceId: "another-invoice",
    }),
    { code: "PAYMENT_MISMATCH" },
  );
  await core.processWalletTopupEvent(event(t.id, amount, "error"));
  assert.equal((await core.getWalletTopup(buyer, t.id)).status, "error");
  assert.equal(await balance(), 0);
  await core.simulateWalletTopup(buyer, t.id);
  assert.equal(await balance(), amount);
  await core.processWalletTopupEvent(event(t.id, amount));
  const duplicate = await core.processWalletTopupEvent(event(t.id, amount));
  assert.equal(duplicate.duplicate, true);
  assert.equal(await balance(), amount);
  await ledgerCheck();
});
test("wallet checkout consumes stock, creates paid order without invoice job and repeat cannot debit", async () => {
  const id = await cart(),
    key = randomUUID(),
    before = await balance();
  const [stock] = await (
    await database()
  ).query(
    "SELECT sum(quantity)::integer AS n FROM inventory WHERE variant_id=$1",
    [variant],
  );
  const result = await core.createCheckout(id, input(key), buyer);
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.paymentMethod, "wallet");
  assert.equal(await balance(), before - price);
  const again = await core.createCheckout(id, input(key), buyer);
  assert.equal(again.order.id, result.order.id);
  assert.equal(await balance(), before - price);
  await assert.rejects(core.createCheckout(id, input(key), other), {
    code: "CHECKOUT_CHANGED",
  });
  process.env.APIPAY_MODE = "sandbox";
  await assert.rejects(core.createCheckout(id, input(key), buyer), {
    code: "CHECKOUT_CHANGED",
  });
  process.env.APIPAY_MODE = "mock";
  await assert.rejects(
    core.createCheckout(id, { ...input(key), paymentMethod: "apipay" }, buyer),
    { code: "CHECKOUT_CHANGED" },
  );
  const db = await database();
  const [after] = await db.query(
    "SELECT sum(quantity)::integer AS n,sum(reserved)::integer AS reserved FROM inventory WHERE variant_id=$1",
    [variant],
  );
  assert.equal(after.n, stock.n - 1);
  assert.equal(after.reserved, 0);
  assert.equal(
    (
      await db.query(
        "SELECT id FROM jobs WHERE type='create_invoice' AND payload->>'orderId'=$1",
        [result.order.id],
      )
    ).length,
    0,
  );
  await assert.rejects(
    core.recordInvoice(result.order.id, {
      invoiceId: "attack",
      amount: price,
      environment: "mock",
      paymentUrl: null,
    }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    core.processPaymentEvent({
      eventId: "wallet-order-paid-attack",
      orderId: result.order.id,
      invoiceId: "attack",
      amount: price,
      environment: "mock",
      status: "paid",
    }),
    { code: "PAYMENT_MISMATCH" },
  );
  await assert.rejects(core.refundWalletOrder(buyer, result.order.id), {
    code: "FORBIDDEN",
  });
  assert.equal(
    (await core.refundWalletOrder(staff, result.order.id)).duplicate,
    false,
  );
  assert.equal(
    (await core.refundWalletOrder(staff, result.order.id)).duplicate,
    true,
  );
  assert.equal(await balance(), before);
  const [final] = await db.query(
    "SELECT sum(quantity)::integer AS n FROM inventory WHERE variant_id=$1",
    [variant],
  );
  assert.equal(final.n, after.n);
  await ledgerCheck();
});
test("checkout rejects guest, wrong email and changed price without debiting or consuming cart", async () => {
  const id = await cart(),
    before = await balance();
  await assert.rejects(core.createCheckout(id, input(randomUUID())), {
    code: "UNAUTHORIZED",
  });
  await assert.rejects(
    core.createCheckout(
      id,
      { ...input(randomUUID()), email: "wallet-other@example.test" },
      buyer,
    ),
    { code: "EMAIL_MISMATCH" },
  );
  await assert.rejects(
    core.createCheckout(id, input(randomUUID(), price + 1), buyer),
    { code: "TOTAL_CHANGED" },
  );
  assert.equal(await balance(), before);
  assert.equal((await core.getCart(id)).count, 1);
});
test("insufficient funds and stock failure roll back every financial mutation", async () => {
  const id = await cart();
  await assert.rejects(
    core.createCheckout(
      id,
      { ...input(randomUUID()), email: "wallet-other@example.test" },
      other,
    ),
    { code: "INSUFFICIENT_FUNDS" },
  );
  assert.equal((await core.getWallet(other)).balance, 0);
  assert.equal((await core.getCart(id)).count, 1);
  const before = await balance(),
    db = await database();
  const stock = await db.query("SELECT * FROM inventory WHERE variant_id=$1", [
    variant,
  ]);
  await db.query("UPDATE inventory SET quantity=reserved WHERE variant_id=$1", [
    variant,
  ]);
  await assert.rejects(core.createCheckout(id, input(randomUUID()), buyer));
  assert.equal(await balance(), before);
  for (const row of stock)
    await db.query(
      "UPDATE inventory SET quantity=$1 WHERE variant_id=$2 AND branch_id=$3",
      [row.quantity, variant, row.branch_id],
    );
  await ledgerCheck();
});
test("concurrent checkouts cannot overspend a wallet across visitors", async () => {
  // Other customer has exactly one order of money, backed by a provider-confirmed topup.
  const t = await core.createWalletTopup(other, {
    amount: price,
    phone: "+77011234567",
    idempotencyKey: randomUUID(),
  });
  await core.simulateWalletTopup(other, t.id);
  const a = await cart(),
    b = await cart();
  const results = await Promise.allSettled([
    core.createCheckout(
      a,
      { ...input(randomUUID()), email: "wallet-other@example.test" },
      other,
    ),
    core.createCheckout(
      b,
      { ...input(randomUUID()), email: "wallet-other@example.test" },
      other,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal((await core.getWallet(other)).balance, 0);
});
test("ledger is immutable and remains reconcilable", async () => {
  const db = await database();
  await assert.rejects(
    db.query("UPDATE wallet_entries SET amount=amount+1 WHERE user_id=$1", [
      buyer,
    ]),
    /immutable/,
  );
  await assert.rejects(
    db.query("DELETE FROM wallet_entries WHERE user_id=$1", [buyer]),
    /immutable/,
  );
  await ledgerCheck();
});
test("full topup refund reverses once, delayed paid cannot restore refunded money", async () => {
  const t = await topup(price),
    before = await balance();
  const result = await core.processWalletTopupEvent(
    event(t.id, price, "refunded"),
  );
  assert.equal(result.resolved, true);
  assert.equal(await balance(), before - price);
  await core.processWalletTopupEvent(
    event(t.id, price, "refunded", "other-refund-notification"),
  );
  await core.processWalletTopupEvent(event(t.id, price, "paid", "late-paid"));
  assert.equal(await balance(), before - price);
  await ledgerCheck();
});
test("refund-before-paid never creates an unbacked credit", async () => {
  const t = await core.createWalletTopup(buyer, {
      amount: price,
      phone: "+77011234567",
      idempotencyKey: randomUUID(),
    }),
    before = await balance();
  await core.processWalletTopupEvent(event(t.id, price, "refunded"));
  await core.processWalletTopupEvent(event(t.id, price, "paid"));
  assert.equal(await balance(), before);
  await ledgerCheck();
});
test("spent topup refund freezes account and persists unresolved debt; payment stays blocked", async () => {
  const id = await cart();
  const existing = await balance();
  // Spend the existing balance with ordinary purchases so the final backed topup is fully spent.
  const t = await topup(price);
  const db = await database();
  const product = (await core.getProduct(
    (await core.getProducts()).find((p) => p.id === productId)!.slug,
  ))!;
  // Raise server price to total funded balance, without inserting any artificial wallet credit.
  await db.query("UPDATE products SET price=$1 WHERE id=$2", [
    existing + price,
    product.id,
  ]);
  const key = randomUUID();
  const paid = await core.createCheckout(
    id,
    input(key, existing + price),
    buyer,
  );
  await db.query("UPDATE products SET price=$1 WHERE id=$2", [
    price,
    product.id,
  ]);
  assert.equal(await balance(), 0);
  const result = await core.processWalletTopupEvent(
    event(t.id, price, "refunded"),
  );
  assert.equal(result.resolved, false);
  assert.equal(result.status, "manual_review");
  assert.equal((await core.getWallet(buyer)).frozen, true);
  assert.equal(await balance(), 0);
  const replay = await core.createCheckout(
    id,
    input(key, existing + price),
    buyer,
  );
  assert.equal(replay.order.id, paid.order.id);
  const [stored] = await db.query(
    "SELECT resolved FROM wallet_topup_events WHERE event_id=$1",
    [`test:${t.id}:refunded`],
  );
  assert.equal(stored.resolved, false);
  const again = await core.processWalletTopupEvent(
    event(t.id, price, "refunded"),
  );
  assert.equal(again.resolved, false);
  await assert.rejects(
    core.createCheckout(await cart(), input(randomUUID()), buyer),
    { code: "WALLET_FROZEN" },
  );
  await assert.rejects(
    core.createWalletTopup(buyer, {
      amount: price,
      phone: "+77011234567",
      idempotencyKey: randomUUID(),
    }),
    { code: "WALLET_FROZEN" },
  );
  await ledgerCheck();
});

test("known partial refund reverses exact cumulative amount, freezes review, and cannot overreverse", async () => {
  const id = randomUUID();
  await (
    await database()
  ).query("INSERT INTO users(id,email,role) VALUES($1,$2,'customer')", [
    id,
    `partial-${id}@example.test`,
  ]);
  const t = await core.createWalletTopup(id, {
    amount: 1000,
    phone: "+77011234567",
    idempotencyKey: randomUUID(),
  });
  await core.simulateWalletTopup(id, t.id);
  const first = await core.processWalletTopupEvent({
    ...event(t.id, 1000, "partially_refunded", "partial-1"),
    refundedAmount: 300,
  });
  assert.equal(first.resolved, false);
  assert.equal((await core.getWallet(id)).balance, 700);
  assert.equal((await core.getWallet(id)).frozen, true);
  await core.processWalletTopupEvent({
    ...event(t.id, 1000, "partially_refunded", "partial-2"),
    refundedAmount: 500,
  });
  assert.equal((await core.getWallet(id)).balance, 500);
  await core.processWalletTopupEvent({
    ...event(t.id, 1000, "partially_refunded", "old-partial"),
    refundedAmount: 300,
  });
  assert.equal((await core.getWallet(id)).balance, 500);
  await core.processWalletTopupEvent(event(t.id, 1000, "refunded"));
  assert.equal((await core.getWallet(id)).balance, 0);
});
test("fractional or absent partial refund totals freeze without inventing a debit", async () => {
  for (const total of [undefined, 100.5]) {
    const id = randomUUID();
    await (
      await database()
    ).query("INSERT INTO users(id,email,role) VALUES($1,$2,'customer')", [
      id,
      `unknown-${id}@example.test`,
    ]);
    const t = await core.createWalletTopup(id, {
      amount: 1000,
      phone: "+77011234567",
      idempotencyKey: randomUUID(),
    });
    await core.simulateWalletTopup(id, t.id);
    const result = await core.processWalletTopupEvent({
      ...event(t.id, 1000, "partially_refunded"),
      ...(total !== undefined ? { refundedAmount: total } : {}),
    });
    assert.equal(result.resolved, false);
    const wallet = await core.getWallet(id);
    assert.equal(wallet.frozen, true);
    assert.equal(wallet.balance, 1000);
  }
});
