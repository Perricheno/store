import test, { after } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = process.env.CORE_TEST_DATABASE_URL || "";
process.env.PGLITE_DATA_DIR = "memory://";
process.env.APP_ENV = "test";
process.env.APIPAY_MODE = "mock";
process.env.MAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.BOOTSTRAP_OWNER_EMAIL = "owner@example.test";
process.env.BOOTSTRAP_OWNER_PASSWORD = "Owner-Temporary-Password-123";
const core = await import("../src/index");
const { database, transaction } = await import("../src/db");
after(() => core.closeCore());
let actorId: string;
const visitor = (n: number) => `test_visitor_${String(n).padStart(20, "0")}`;
const checkout = (
  key: string,
  total: number,
  email = "buyer@example.test",
) => ({
  email,
  phone: "+7 701 123 45 67",
  fulfillment: "pickup",
  expectedTotal: total,
  idempotencyKey: key,
  locale: "ru" as const,
});
test("bootstrap owner is forced to rotate password; realms cannot cross", async () => {
  await core.initCore();
  const session = await core.createSession(
    "owner@example.test",
    "Owner-Temporary-Password-123",
    "staff",
  );
  actorId = session.user.id;
  assert.equal(session.user.mustChangePassword, true);
  await assert.rejects(core.listUsers(actorId), {
    code: "PASSWORD_CHANGE_REQUIRED",
  });
  assert.equal(await core.getSession(session.token, "buyer"), null);
  await assert.rejects(
    core.createSession(
      "owner@example.test",
      "Owner-Temporary-Password-123",
      "buyer",
    ),
    { code: "INVALID_CREDENTIALS" },
  );
  await core.changePassword(
    session.token,
    "staff",
    "Owner-Temporary-Password-123",
    "Owner-Permanent-Password-123",
  );
  assert.equal(
    (await core.getSession(session.token, "staff"))?.mustChangePassword,
    false,
  );
});
test("translated demo catalog has integer prices, no photos or unverified marketplace links", async () => {
  const products = await core.getProducts();
  assert.equal(products.length, 12);
  for (const p of products) {
    assert.equal(p.isDemo, true);
    assert.ok(p.names.ru && p.names.kk && p.names.en);
    assert.ok(Number.isInteger(p.price));
    assert.deepEqual(p.media, []);
    assert.equal(p.kaspiUrl, undefined);
  }
  assert.equal((await core.getProducts({ category: "sneakers" })).length, 1);
});
test("cart updates set quantities; favorites are visitor isolated", async () => {
  const product = (await core.getProducts())[0]!;
  const v = visitor(1);
  assert.equal((await core.updateCart(v, product.sizes[0]!.id, 2)).count, 2);
  assert.equal((await core.updateCart(v, product.sizes[0]!.id, 1)).count, 1);
  assert.equal(await core.toggleFavorite(v, product.id), true);
  assert.equal((await core.getFavorites(v)).length, 1);
  assert.equal((await core.getFavorites(visitor(2))).length, 0);
  assert.equal(await core.toggleFavorite(v, product.id), false);
});
test("checkout is idempotent and encrypted mail never stores clear credentials", async () => {
  const product = (await core.getProducts())[1]!;
  const v = visitor(3);
  await core.updateCart(v, product.sizes[0]!.id, 1);
  const input = checkout("checkout_once_123", product.price);
  const first = await core.createCheckout(v, input);
  const second = await core.createCheckout(v, input);
  assert.equal(first.order.id, second.order.id);
  assert.ok(first.accessToken);
  assert.equal(
    await core.getOrder(first.order.id, { visitorId: visitor(4) }),
    null,
  );
  assert.equal(
    (await core.getOrder(first.order.id, { accessToken: first.accessToken }))
      ?.id,
    first.order.id,
  );
  await assert.rejects(
    core.createCheckout(v, { ...input, phone: "+7 777 111 22 33" }),
    { code: "CHECKOUT_CHANGED" },
  );
  const db = await database();
  const [row] = await db.query(
    "SELECT payload FROM jobs WHERE type='send_mail' LIMIT 1",
  );
  assert.ok(row.payload.encrypted);
  assert.ok(!JSON.stringify(row.payload).includes("buyer@example.test"));
  const mail = core.decryptMailPayload(row.payload);
  assert.equal(mail.to, "buyer@example.test");
  assert.match(mail.text, /24/);
});
test("existing email is never attached without authentication", async () => {
  const product = (await core.getProducts())[2]!;
  const v = visitor(5);
  await core.updateCart(v, product.sizes[0]!.id, 1);
  const result = await core.createCheckout(
    v,
    checkout("existing_email_123", product.price),
  );
  const db = await database();
  const [row] = await db.query("SELECT user_id FROM orders WHERE id=$1", [
    result.order.id,
  ]);
  assert.equal(row.user_id, null);
});
test("two competing checkouts cannot reserve the final unit twice", async () => {
  const product = (await core.getProducts())[3]!;
  const variant = product.sizes[0]!.id;
  await core.setInventory(actorId, variant, 1);
  const a = visitor(6),
    b = visitor(7);
  await core.updateCart(a, variant, 1);
  await core.updateCart(b, variant, 1);
  const results = await Promise.allSettled([
    core.createCheckout(
      a,
      checkout("stock_race_a_123", product.price, "race-a@example.test"),
    ),
    core.createCheckout(
      b,
      checkout("stock_race_b_123", product.price, "race-b@example.test"),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const [stock] = await (
    await database()
  ).query("SELECT quantity,reserved FROM inventory WHERE variant_id=$1", [
    variant,
  ]);
  assert.equal(stock.quantity, 1);
  assert.equal(stock.reserved, 1);
});
test("payments validate association, consume once, release expired stock and review late money", async () => {
  const product = (await core.getProducts())[4]!;
  const variant = product.sizes[0]!.id,
    v = visitor(8);
  await core.updateCart(v, variant, 1);
  const { order } = await core.createCheckout(
    v,
    checkout("payment_once_123", product.price, "payment@example.test"),
  );
  await core.recordInvoice(order.id, {
    invoiceId: "mock-invoice-1",
    paymentUrl: "http://localhost:3000/pay",
    environment: "mock",
    amount: order.total,
  });
  const event = {
    eventId: "event-one",
    orderId: order.id,
    invoiceId: "mock-invoice-1",
    amount: order.total,
    environment: "mock",
    status: "paid" as const,
  };
  await assert.rejects(
    core.processPaymentEvent({ ...event, amount: order.total + 1 }),
    { code: "PAYMENT_MISMATCH" },
  );
  assert.equal((await core.processPaymentEvent(event)).status, "paid");
  assert.equal((await core.processPaymentEvent(event)).duplicate, true);
  assert.equal(
    (await core.processPaymentEvent({ ...event, eventId: "event-two" })).status,
    "paid",
  );
  const [stock] = await (
    await database()
  ).query("SELECT quantity,reserved FROM inventory WHERE variant_id=$1", [
    variant,
  ]);
  assert.equal(stock.quantity, 7);
  assert.equal(stock.reserved, 0);
  await core.processPaymentEvent({
    ...event,
    eventId: "event-refund",
    status: "refunded",
  });
  const [after] = await (
    await database()
  ).query("SELECT quantity FROM inventory WHERE variant_id=$1", [variant]);
  assert.equal(after.quantity, 7);
  const v2 = visitor(9);
  await core.updateCart(v2, variant, 1);
  const late = (
    await core.createCheckout(
      v2,
      checkout("payment_late_123", product.price, "late@example.test"),
    )
  ).order;
  await core.recordInvoice(late.id, {
    invoiceId: "mock-late",
    paymentUrl: "http://localhost:3000/pay",
    environment: "mock",
    amount: late.total,
  });
  await (
    await database()
  ).query(
    "UPDATE orders SET expires_at=now()-interval '1 second' WHERE id=$1",
    [late.id],
  );
  assert.equal(await core.expireReservations(), 0);
  assert.equal(
    (
      await core.processPaymentEvent({
        eventId: "provider-expired",
        orderId: late.id,
        invoiceId: "mock-late",
        amount: late.total,
        environment: "mock",
        status: "expired",
      })
    ).status,
    "expired",
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        eventId: "late-paid",
        orderId: late.id,
        invoiceId: "mock-late",
        amount: late.total,
        environment: "mock",
        status: "paid",
      })
    ).status,
    "manual_review",
  );
  assert.equal(
    (
      await (
        await database()
      ).query("SELECT quantity,reserved FROM inventory WHERE variant_id=$1", [
        variant,
      ])
    )[0]?.quantity,
    7,
  );
});
test("kazpost and real payments for demo inventory are blocked", async () => {
  const product = (await core.getProducts())[5]!,
    v = visitor(10);
  await core.updateCart(v, product.sizes[0]!.id, 1);
  await assert.rejects(
    core.createCheckout(v, {
      ...checkout("blocked_kazpost_123", product.price),
      fulfillment: "kazpost",
    }),
    { code: "VALIDATION" },
  );
  process.env.APIPAY_MODE = "production";
  await assert.rejects(
    core.createCheckout(v, checkout("blocked_demo_123", product.price)),
    { code: "DEMO_PAYMENT_BLOCKED" },
  );
  process.env.APIPAY_MODE = "mock";
});
test("jobs are claimed exclusively and retries preserve encrypted payload", async () => {
  const [a, b] = await Promise.all([core.claimJob("a"), core.claimJob("b")]);
  assert.ok(a && b);
  assert.notEqual(a.id, b.id);
  await core.finishJob(a.id);
  await core.failJob(b.id, "retryable");
  const [row] = await (
    await database()
  ).query("SELECT status,payload,last_error FROM jobs WHERE id=$1", [b.id]);
  assert.equal(row.status, "pending");
  assert.equal(row.last_error, "retryable");
});

test("temporary account claims are single use and reset revokes sessions", async () => {
  const rows = await (
    await database()
  ).query(
    "SELECT payload FROM jobs WHERE type='send_mail' AND payload ? 'encrypted'",
  );
  const welcome = rows
    .map((row) => core.decryptMailPayload(row.payload))
    .find(
      (mail) =>
        mail.to === "payment@example.test" && mail.subject.includes("аккаунт"),
    )!;
  const claim = new URL(welcome.text.match(/http[^\s]+/)![0]).searchParams.get(
    "token",
  )!;
  await core.claimAccount(claim, "Permanent-Buyer-Password-123");
  await assert.rejects(core.claimAccount(claim, "Another-Buyer-Password-123"), {
    code: "INVALID_TOKEN",
  });
  const session = await core.createSession(
    "payment@example.test",
    "Permanent-Buyer-Password-123",
    "buyer",
  );
  assert.equal(session.user.mustChangePassword, false);
  assert.ok((await core.getCustomerOrders(session.user.id)).length > 0);
  assert.deepEqual(await core.requestPasswordReset("missing@example.test"), {
    ok: true,
  });
  await core.requestPasswordReset("payment@example.test");
  const mailRows = await (
    await database()
  ).query(
    "SELECT payload FROM jobs WHERE type='send_mail' AND payload ? 'encrypted'",
  );
  const reset = mailRows
    .map((row) => core.decryptMailPayload(row.payload))
    .find(
      (mail) =>
        mail.to === "payment@example.test" && mail.subject.includes("смена"),
    )!;
  const resetToken = new URL(
    reset.text.match(/http[^\s]+/)![0],
  ).searchParams.get("token")!;
  await core.resetPassword(resetToken, "Reset-Buyer-Password-123");
  assert.equal(await core.getSession(session.token, "buyer"), null);
  await assert.rejects(
    core.resetPassword(resetToken, "Repeated-Buyer-Password-123"),
    { code: "INVALID_TOKEN" },
  );
});

test("verified webhook may precede create response; local timeout cannot free live stock", async () => {
  const product = (await core.getProducts())[6]!,
    variant = product.sizes[1]!.id,
    v = visitor(12);
  await core.updateCart(v, variant, 1);
  const { order } = await core.createCheckout(
    v,
    checkout("webhook_race_123", product.price, "webhook@example.test"),
  );
  const result = await core.processPaymentEvent({
    eventId: "early-event",
    orderId: order.id,
    invoiceId: "early-invoice",
    amount: order.total,
    environment: "mock",
    status: "paid",
  });
  assert.equal(result.status, "paid");
  await core.recordInvoice(order.id, {
    invoiceId: "early-invoice",
    paymentUrl: null,
    environment: "mock",
    amount: order.total,
  });
  await assert.rejects(
    core.recordInvoice(order.id, {
      invoiceId: "different-invoice",
      paymentUrl: null,
      environment: "mock",
      amount: order.total,
    }),
    { code: "INVOICE_EXISTS" },
  );
  const cancelled = await core.advanceOrder(actorId, order.id, "cancelled");
  assert.equal(cancelled.status, "refund_required");
  const v2 = visitor(13);
  await core.updateCart(v2, variant, 1);
  const unpaid = (
    await core.createCheckout(
      v2,
      checkout("unpaid_cancel_123", product.price, "unpaid@example.test"),
    )
  ).order;
  await assert.rejects(core.advanceOrder(actorId, unpaid.id, "cancelled"), {
    code: "PROVIDER_CONFIRMATION_REQUIRED",
  });
  await (
    await database()
  ).query("UPDATE orders SET expires_at=now()-interval '1 day' WHERE id=$1", [
    unpaid.id,
  ]);
  assert.equal(await core.expireReservations(), 0);
  const [reserved] = await (
    await database()
  ).query("SELECT state FROM reservations WHERE order_id=$1", [unpaid.id]);
  assert.equal(reserved.state, "reserved");
});

test("checkout retry does not duplicate invoice jobs; modified cart conflicts with a replay", async () => {
  const product = (await core.getProducts())[7]!,
    v = visitor(14),
    variant = product.sizes[1]!.id;
  await core.updateCart(v, variant, 1);
  const input = checkout(
    "retry_checkout_123",
    product.price,
    "retry@example.test",
  );
  const { order } = await core.createCheckout(v, input);
  await core.retryPayment(order.id, { visitorId: v });
  await core.retryPayment(order.id, { visitorId: v });
  const [count] = await (
    await database()
  ).query(
    "SELECT count(*)::integer AS count FROM jobs WHERE type='create_invoice' AND payload->>'orderId'=$1",
    [order.id],
  );
  assert.equal(count.count, 1);
  await assert.rejects(
    core.retryPayment(order.id, { visitorId: visitor(15) }),
    { code: "NOT_FOUND" },
  );
  await core.updateCart(v, variant, 2);
  await assert.rejects(core.createCheckout(v, input), {
    code: "CHECKOUT_CHANGED",
  });
  const jobs = await core.listJobs(actorId);
  assert.ok(jobs.every((job) => !("payload" in job)));
});

test("branch stocks aggregate, allocate independently and consume exactly the reserved quantities", async () => {
  const product = (await core.getProducts())[8]!,
    variant = product.sizes[2]!.id,
    v = visitor(16);
  await core.setInventory(actorId, variant, 0);
  await core.setInventory(actorId, variant, 1, "east");
  await core.setInventory(actorId, variant, 1, "west");
  const refreshed = await core.getProduct(product.slug);
  assert.equal(
    refreshed!.sizes.find((size) => size.id === variant)!.available,
    2,
  );
  await core.updateCart(v, variant, 2);
  const { order } = await core.createCheckout(
    v,
    checkout("branch_order_123", product.price * 2, "branches@example.test"),
  );
  const reservations = await (
    await database()
  ).query(
    "SELECT branch_id,quantity FROM reservations WHERE order_id=$1 ORDER BY branch_id",
    [order.id],
  );
  assert.deepEqual(reservations, [
    { branch_id: "east", quantity: 1 },
    { branch_id: "west", quantity: 1 },
  ]);
  await assert.rejects(core.setInventory(actorId, variant, 0, "east"), {
    code: "RESERVED_STOCK",
  });
  await core.processPaymentEvent({
    eventId: "branches-paid",
    orderId: order.id,
    invoiceId: "branches-invoice",
    amount: order.total,
    environment: "mock",
    status: "paid",
  });
  const inventory = (await core.getInventory(actorId)).filter(
    (row) => row.variantId === variant,
  );
  assert.ok(inventory.every((row) => row.quantity === 0 && row.reserved === 0));
});

test("welcome email uses order locale and claiming never imports other guest orders with the same email", async () => {
  const product = (await core.getProducts())[9]!;
  for (const [n, locale, phrase] of [
    [17, "kk", "құпиясөзіңіз"],
    [19, "en", "temporary password"],
  ] as const) {
    const email = `locale-${locale}@example.test`,
      first = visitor(n),
      second = visitor(n + 1);
    await core.updateCart(first, product.sizes[3]!.id, 1);
    const initial = (
      await core.createCheckout(first, {
        ...checkout(`locale_${locale}_first_123`, product.price, email),
        locale,
      })
    ).order;
    await core.updateCart(second, product.sizes[3]!.id, 1);
    const guest = (
      await core.createCheckout(second, {
        ...checkout(`locale_${locale}_guest_123`, product.price, email),
        locale,
      })
    ).order;
    const rows = await (
      await database()
    ).query(
      "SELECT payload FROM jobs WHERE type='send_mail' AND payload ? 'encrypted'",
    );
    const mails = rows
      .map((row) => core.decryptMailPayload(row.payload))
      .filter((mail) => mail.to === email);
    assert.equal(mails.length, 1);
    assert.match(mails[0]!.text, new RegExp(phrase));
    assert.ok(mails[0]!.text.includes(email));
    const claim = new URL(
      mails[0]!.text.match(/http[^\s]+/)![0],
    ).searchParams.get("token")!;
    await core.claimAccount(claim, "Claimed-Buyer-Password-123");
    const session = await core.createSession(
      email,
      "Claimed-Buyer-Password-123",
      "buyer",
    );
    const accountOrders = await core.getCustomerOrders(session.user.id);
    assert.deepEqual(
      accountOrders.map((order) => order.id),
      [initial.id],
    );
    assert.equal(
      await core.getOrder(guest.id, { userId: session.user.id }),
      null,
    );
  }
});

test("live checkout fails before reserving when provider and email configuration is missing", async () => {
  const p = await core.upsertProduct(actorId, {
    slug: "real-test-item",
    category: "t-shirts",
    gender: "unisex",
    brand: "Test",
    names: { ru: "Тест", kk: "Сынақ", en: "Test" },
    description: { ru: "Описание", kk: "Сипаттама", en: "Description" },
    price: 10000,
    media: [],
    isDemo: false,
    published: true,
    sizes: [{ size: "M", color: "Black" }],
  });
  const variant = p.sizes[0]!.id;
  await core.setInventory(actorId, variant, 1);
  const v = visitor(21);
  await core.updateCart(v, variant, 1);
  process.env.APIPAY_MODE = "production";
  const priorKey = process.env.APIPAY_API_KEY;
  delete process.env.APIPAY_API_KEY;
  try {
    await assert.rejects(
      core.createCheckout(
        v,
        checkout("missing_provider_123", p.price, "live-test@example.test"),
      ),
      { code: "PAYMENTS_UNAVAILABLE" },
    );
  } finally {
    process.env.APIPAY_MODE = "mock";
    if (priorKey) process.env.APIPAY_API_KEY = priorKey;
  }
  const [stock] = await (
    await database()
  ).query("SELECT quantity,reserved FROM inventory WHERE variant_id=$1", [
    variant,
  ]);
  assert.deepEqual(stock, { quantity: 1, reserved: 0 });
  assert.equal((await core.getCart(v)).count, 1);
});

test("database adapters preserve JSON, timestamps and SQL arrays in pooled and transactional queries", async () => {
  const document = { locale: "kk", nested: { count: 2 } },
    moment = new Date("2026-01-02T03:04:05.000Z"),
    ids = ["alpha", "beta"];
  const sql =
    "SELECT $1::jsonb AS document,$2::timestamptz AS moment,$3::text[] AS ids";
  const check = (row: Record<string, any>) => {
    assert.deepEqual(row.document, document);
    assert.equal(new Date(row.moment).toISOString(), moment.toISOString());
    assert.deepEqual(row.ids, ids);
  };
  check((await (await database()).query(sql, [document, moment, ids]))[0]!);
  check(
    await transaction(
      async (db) => (await db.query(sql, [document, moment, ids]))[0]!,
    ),
  );
});
