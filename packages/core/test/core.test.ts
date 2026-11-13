import test, { after } from "node:test";
import assert from "node:assert/strict";
import type { Settings } from "../src/types";
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
  assert.equal(products.length, 500);
  for (const p of products) {
    assert.equal(p.isDemo, true);
    assert.ok(p.names.ru && p.names.kk && p.names.en);
    assert.ok(Number.isInteger(p.price));
    assert.deepEqual(p.media, []);
    assert.equal(p.kaspiUrl, undefined);
    assert.equal(p.brand, "DEMO");
    assert.equal(p.oldPrice, undefined);
  }
  assert.equal(new Set(products.map((product) => product.id)).size, 500);
  assert.equal(new Set(products.map((product) => product.slug)).size, 500);
  for (const locale of ["ru", "kk", "en"] as const)
    assert.equal(
      new Set(products.map((product) => product.names[locale])).size,
      500,
    );
  assert.deepEqual(
    new Set(products.map((product) => product.category)),
    new Set(core.CATEGORIES.map((category) => category.id)),
  );
  for (const category of core.CATEGORIES) {
    assert.ok(category.names.ru && category.names.kk && category.names.en);
    assert.ok(
      products.filter((product) => product.category === category.id).length >=
        28,
    );
  }
  for (const slug of [
    "city-tee",
    "essential-tee",
    "studio-shirt",
    "linen-shirt",
    "heavy-hoodie",
    "weekend-hoodie",
    "shell-jacket",
    "field-jacket",
    "wide-trousers",
    "daily-chino",
    "canvas-tote",
    "court-sneakers",
  ])
    assert.ok(products.some((product) => product.slug === slug));
  assert.equal((await core.getProducts({ category: "sneakers" })).length, 30);
});
test("SQL catalog pagination is stable, bounded and applies stock, language, size and price filters before slicing", async () => {
  const all = await core.getProducts(),
    first = await core.getCatalogPage(),
    second = await core.getCatalogPage({ page: 2 });
  assert.equal(first.total, 500);
  assert.equal(first.page, 1);
  assert.equal(first.pageSize, 24);
  assert.equal(first.hasMore, true);
  assert.equal(first.products.length, 24);
  assert.deepEqual(
    (await core.getCatalogPage()).products.map((product) => product.id),
    first.products.map((product) => product.id),
  );
  assert.equal(
    new Set(
      [...first.products, ...second.products].map((product) => product.id),
    ).size,
    48,
  );
  const last = await core.getCatalogPage({ page: 21 });
  assert.equal(last.products.length, 20);
  assert.equal(last.hasMore, false);
  assert.deepEqual((await core.getCatalogPage({ page: 22 })).products, []);
  const filters = {
    category: "basketball-shoes",
    q: "БАСКЕТБОЛ",
    gender: "men",
    size: "42",
    minPrice: 44000,
    maxPrice: 50000,
    inStock: true,
    sort: "price-asc",
  };
  const expected = all
    .filter(
      (product) =>
        product.category === filters.category &&
        (product.gender === "men" || product.gender === "unisex") &&
        product.names.ru.toLocaleLowerCase().includes("баскетбол") &&
        product.price >= filters.minPrice &&
        product.price <= filters.maxPrice &&
        product.sizes.some((size) => size.size === "42" && size.available > 0),
    )
    .sort(
      (a, b) =>
        a.price - b.price ||
        b.createdAt.localeCompare(a.createdAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const collected: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await core.getCatalogPage({ ...filters, page, pageSize: 7 });
    assert.equal(result.total, expected.length);
    collected.push(...result.products.map((product) => product.id));
    if (!result.hasMore) break;
  }
  assert.ok(expected.length > 0);
  assert.deepEqual(
    collected,
    expected.map((product) => product.id),
  );
  for (const q of ["%", "_", "' OR true --"]) {
    assert.equal((await core.getCatalogPage({ q })).total, 0);
  }
  assert.equal((await core.getCatalogPage({ q: "Арқасөмке" })).total, 29);
  await assert.rejects(core.getCatalogPage({ page: 0 }), {
    code: "VALIDATION",
  });
  await assert.rejects(core.getCatalogPage({ pageSize: 61 }), {
    code: "VALIDATION",
  });
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

test("job type filtering preserves attempts for unavailable integrations", async () => {
  const db = await database();
  await db.query("INSERT INTO jobs(id,type,payload,status,available_at,attempts,locked_at) VALUES ('filter-payment','create_invoice','{}','pending','2000-01-01',0,NULL), ('filter-stale','create_wallet_topup_invoice','{}','running','2000-01-01',1,'2000-01-01'), ('filter-mail','send_mail','{}','pending','2000-01-01',0,NULL)");
  try {
    assert.equal(await core.claimJob('filter-worker', []), null);
    const mail = await core.claimJob('filter-worker', ['send_mail']);
    assert.equal(mail?.id, 'filter-mail');
    const rows = await db.query("SELECT id,status,attempts FROM jobs WHERE id=ANY($1::text[]) ORDER BY id", [['filter-payment', 'filter-stale']]);
    assert.deepEqual(rows.map(({ id, status, attempts }) => ({ id, status, attempts })), [
      { id: 'filter-payment', status: 'pending', attempts: 0 },
      { id: 'filter-stale', status: 'running', attempts: 1 },
    ]);
    const stale = await core.claimJob('filter-worker', ['create_wallet_topup_invoice']);
    assert.equal(stale?.id, 'filter-stale');
    assert.equal(stale?.attempts, 2);
  } finally {
    await db.query("DELETE FROM jobs WHERE id=ANY($1::text[])", [['filter-payment', 'filter-stale', 'filter-mail']]);
  }
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

test("paid notifications preserve an outstanding refund until a verified full refund", async () => {
  const product = (await core.getProduct("city-tee"))!,
    variant = product.sizes[0]!.id,
    v = visitor(22);
  await core.updateCart(v, variant, 1);
  const { order } = await core.createCheckout(
    v,
    checkout(
      "refund_obligation_123",
      product.price,
      "refund-obligation@example.test",
    ),
  );
  const paid = {
    eventId: "refund-obligation-paid",
    orderId: order.id,
    invoiceId: "refund-obligation-invoice",
    amount: order.total,
    environment: "mock",
    status: "paid" as const,
  };
  await core.processPaymentEvent(paid);
  assert.equal(
    (await core.advanceOrder(actorId, order.id, "cancelled")).status,
    "refund_required",
  );
  const before = await (
    await database()
  ).query(
    "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
    [variant],
  );
  assert.deepEqual(await core.processPaymentEvent(paid), {
    status: "refund_required",
    duplicate: true,
  });
  assert.deepEqual(
    await core.processPaymentEvent({
      ...paid,
      eventId: "refund-obligation-reconciled-paid",
    }),
    { status: "refund_required", duplicate: false },
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        ...paid,
        eventId: "refund-obligation-partial",
        status: "partially_refunded",
      })
    ).status,
    "refund_required",
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        ...paid,
        eventId: "refund-obligation-paid-after-partial",
      })
    ).status,
    "refund_required",
  );
  assert.equal(
    (await core.getOrder(order.id, { visitorId: v }))!.status,
    "refund_required",
  );
  assert.deepEqual(
    await (
      await database()
    ).query(
      "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
      [variant],
    ),
    before,
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        ...paid,
        eventId: "refund-obligation-fully-refunded",
        status: "refunded",
      })
    ).status,
    "refunded",
  );
  assert.deepEqual(
    await (
      await database()
    ).query(
      "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
      [variant],
    ),
    before,
  );
});

test("product descriptions may be empty or omitted while all translated names remain mandatory", async () => {
  const input = {
    slug: "description-optional",
    category: "accessories",
    gender: "unisex",
    brand: "Test",
    names: { ru: "Название", kk: "Атауы", en: "Name" },
    price: 10000,
    media: [],
    isDemo: false,
    published: false,
    sizes: [{ size: "ONE SIZE", color: "Black" }],
  };
  const created = await core.upsertProduct(actorId, input);
  assert.deepEqual(created.description, { ru: "", kk: "", en: "" });
  const updated = await core.upsertProduct(actorId, {
    ...input,
    id: created.id,
    description: { ru: "", kk: "   ", en: "" },
    sizes: created.sizes,
  });
  assert.deepEqual(updated.description, { ru: "", kk: "", en: "" });
  await assert.rejects(
    core.upsertProduct(actorId, {
      ...input,
      slug: "name-still-required",
      description: { ru: "", kk: "", en: "" },
      names: { ru: "", kk: "Атауы", en: "Name" },
    }),
    { code: "VALIDATION" },
  );
  await assert.rejects(
    core.upsertProduct(actorId, {
      ...input,
      slug: "translation-still-required",
      names: { ru: "Название", en: "Name" },
    }),
    { code: "VALIDATION" },
  );
});

test("a full refund before paid releases its reservation and delayed paid cannot consume it", async () => {
  const product = (await core.getProduct("essential-tee"))!,
    variant = product.sizes[1]!.id,
    v = visitor(23),
    db = await database();
  const before = await db.query(
    "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
    [variant],
  );
  await core.updateCart(v, variant, 1);
  const { order } = await core.createCheckout(
    v,
    checkout(
      "refund_before_paid_123",
      product.price,
      "refund-before-paid@example.test",
    ),
  );
  const event = {
    eventId: "full-refund-first",
    orderId: order.id,
    invoiceId: "full-refund-before-paid-invoice",
    amount: order.total,
    environment: "mock",
    status: "refunded" as const,
  };
  await core.processPaymentEvent(event);
  assert.deepEqual(
    await db.query(
      "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
      [variant],
    ),
    before,
  );
  assert.equal(
    (
      await db.query("SELECT state FROM reservations WHERE order_id=$1", [
        order.id,
      ])
    )[0]!.state,
    "released",
  );
  await core.processPaymentEvent({
    ...event,
    eventId: "delayed-paid-after-full-refund",
    status: "paid",
  });
  assert.equal(
    (
      await db.query("SELECT status FROM payments WHERE order_id=$1", [
        order.id,
      ])
    )[0]!.status,
    "refunded",
  );
  assert.deepEqual(
    await db.query(
      "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
      [variant],
    ),
    before,
  );
});

test("delayed partial refunds cannot regress a completed full refund", async () => {
  const product = (await core.getProduct("studio-shirt"))!,
    variant = product.sizes[2]!.id,
    v = visitor(24),
    db = await database();
  await core.updateCart(v, variant, 1);
  const { order } = await core.createCheckout(
    v,
    checkout(
      "refund_monotonic_123",
      product.price,
      "monotonic-refund@example.test",
    ),
  );
  const event = {
    eventId: "monotonic-paid",
    orderId: order.id,
    invoiceId: "monotonic-invoice",
    amount: order.total,
    environment: "mock",
    status: "paid" as const,
  };
  await core.processPaymentEvent(event);
  const consumed = await db.query(
    "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
    [variant],
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        ...event,
        eventId: "monotonic-full-refund",
        status: "refunded",
      })
    ).status,
    "refunded",
  );
  assert.equal(
    (
      await core.processPaymentEvent({
        ...event,
        eventId: "monotonic-delayed-partial",
        status: "partially_refunded",
      })
    ).status,
    "refunded",
  );
  assert.equal(
    (
      await db.query("SELECT status FROM payments WHERE order_id=$1", [
        order.id,
      ])
    )[0]!.status,
    "refunded",
  );
  assert.deepEqual(
    await db.query(
      "SELECT quantity,reserved FROM inventory WHERE variant_id=$1 ORDER BY branch_id",
      [variant],
    ),
    consumed,
  );
});

test("staff reset email points to the staff host and routed staff reset path", async () => {
  const prior = process.env.STAFF_URL;
  process.env.STAFF_URL = "https://staff.example.test/";
  try {
    await core.requestPasswordReset("owner@example.test", "staff");
  } finally {
    if (prior) process.env.STAFF_URL = prior;
    else delete process.env.STAFF_URL;
  }
  const rows = await (
    await database()
  ).query(
    "SELECT payload FROM jobs WHERE type='send_mail' AND payload ? 'encrypted'",
  );
  const mail = rows
    .map((row) => core.decryptMailPayload(row.payload))
    .find((mail) => mail.to === "owner@example.test")!;
  const url = new URL(mail.text.match(/http[^\s]+/)![0]);
  assert.equal(url.origin, "https://staff.example.test");
  assert.equal(url.pathname, "/staff/reset-password");
  assert.ok(url.searchParams.get("token"));
});

test("reconciliation prioritizes an old pending invoice and fairly rotates more than 500 historical invoices", async () => {
  const db = await database();
  await db.query(`INSERT INTO orders(id,visitor_id,email,phone,fulfillment,locale,status,total,lines,idempotency_key,request_hash,access_token_hash,expires_at,created_at)
 SELECT 'rotation-order-'||n,'rotation-visitor-xxxxxxxx','rotation@example.test','+7 701 123 45 67','pickup','ru',CASE WHEN n=0 THEN 'awaiting_payment' ELSE 'paid' END,10000,'[]'::jsonb,'rotation-key-'||n,'fixture','fixture',now()+interval '1 day',now()-interval '1 day'+n*interval '1 second' FROM generate_series(0,501) n`);
  await db.query(`INSERT INTO payments(id,order_id,invoice_id,amount,environment,status,created_at)
 SELECT 'rotation-payment-'||n,'rotation-order-'||n,'rotation-invoice-'||n,10000,'mock',CASE WHEN n=0 THEN 'pending' ELSE 'paid' END,now()-interval '1 day'+n*interval '1 second' FROM generate_series(0,501) n`);
  const first = await core.listPendingInvoices();
  assert.equal(first.length, 50);
  assert.ok(first.some((invoice) => invoice.orderId === "rotation-order-0"));
  const seen = new Set(
    first
      .filter((invoice) => invoice.orderId.startsWith("rotation-order-"))
      .map((invoice) => invoice.orderId),
  );
  for (let i = 0; i < 29 && seen.size < 502; i++) {
    const batch = await core.listPendingInvoices();
    assert.ok(batch.length <= 50);
    for (const invoice of batch)
      if (invoice.orderId.startsWith("rotation-order-"))
        seen.add(invoice.orderId);
  }
  assert.equal(seen.size, 502);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM payments WHERE id LIKE 'rotation-payment-%' AND last_checked_at IS NOT NULL",
      )
    )[0]!.count,
    502,
  );
});

test("reconciliation migration upgrades legacy payments and is safe to repeat", async () => {
  const db = await database(),
    { migration } = await import("../src/migration");
  const [before] = await db.query(
    "SELECT count(*)::integer AS count FROM payments",
  );
  await db.exec("ALTER TABLE payments DROP COLUMN last_checked_at CASCADE");
  await db.query("DELETE FROM schema_migrations WHERE version=2");
  await db.exec(migration);
  await db.exec(migration);
  const [after] = await db.query(
    "SELECT count(*)::integer AS count FROM payments",
  );
  assert.equal(after!.count, before!.count);
  assert.equal(
    (await db.query("SELECT last_checked_at FROM payments LIMIT 1"))[0]!
      .last_checked_at,
    null,
  );
  assert.equal(
    (
      await db.query("SELECT version FROM schema_migrations WHERE version=2")
    )[0]!.version,
    2,
  );
  assert.ok((await core.listPendingInvoices()).length > 0);
});

test("versioned 500-item seed upgrades the original catalog without changing user products or stock and is repeatable", async () => {
  const { seed } = await import("../src/seed"),
    { migration } = await import("../src/migration");
  await transaction(async (db) => {
    await db.exec(
      "CREATE SCHEMA core_seed_upgrade_test; SET LOCAL search_path TO core_seed_upgrade_test",
    );
    await db.exec(migration);
    await db.query(
      "INSERT INTO products SELECT * FROM public.products WHERE id LIKE 'demo-%' AND id NOT LIKE 'demo-z-%'",
    );
    await db.query(
      "INSERT INTO variants SELECT v.* FROM public.variants v JOIN products p ON p.id=v.product_id",
    );
    await db.query(
      "INSERT INTO inventory SELECT i.* FROM public.inventory i JOIN variants v ON v.id=i.variant_id",
    );
    await db.query(
      "UPDATE products SET brand='URBANMAG',old_price=CASE WHEN slug='heavy-hoodie' THEN 38900 ELSE NULL END",
    );
    await db.query(
      "INSERT INTO products(id,slug,category,gender,brand,names,description,price,media,is_demo,published) VALUES('user-kept','user-kept','accessories','unisex','User supplied',$1::jsonb,$2::jsonb,12345,'[]',false,false)",
      [
        JSON.stringify({ ru: "Свой товар", kk: "Өз тауары", en: "User item" }),
        JSON.stringify({ ru: "", kk: "", en: "" }),
      ],
    );
    const beforeStock = await db.query(
        "SELECT * FROM inventory ORDER BY variant_id,branch_id",
      ),
      [userBefore] = await db.query(
        "SELECT * FROM products WHERE id='user-kept'",
      );
    await seed(db);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::integer AS count FROM products WHERE is_demo=true",
        )
      )[0]!.count,
      500,
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM products WHERE id='user-kept'"))[0],
      userBefore,
    );
    assert.deepEqual(
      await db.query(
        "SELECT * FROM inventory WHERE variant_id NOT LIKE 'demo-z-%' ORDER BY variant_id,branch_id",
      ),
      beforeStock,
    );
    assert.equal(
      (
        await db.query(
          "SELECT old_price,brand FROM products WHERE slug='heavy-hoodie'",
        )
      )[0]!.old_price,
      null,
    );
    const [expanded] = await db.query(
      "SELECT id FROM products WHERE id LIKE 'demo-z-%' ORDER BY id LIMIT 1",
    );
    await db.query(
      "UPDATE products SET price=55555,published=false WHERE id=$1",
      [expanded!.id],
    );
    await db.query(
      "UPDATE inventory SET quantity=9,reserved=2 WHERE variant_id IN (SELECT id FROM variants WHERE product_id=$1)",
      [expanded!.id],
    );
    const alteredStock = await db.query(
      "SELECT * FROM inventory ORDER BY variant_id,branch_id",
    );
    await seed(db);
    assert.equal(
      (await db.query("SELECT count(*)::integer AS count FROM products"))[0]!
        .count,
      501,
    );
    assert.equal(
      (
        await db.query("SELECT price,published FROM products WHERE id=$1", [
          expanded!.id,
        ])
      )[0]!.price,
      55555,
    );
    assert.deepEqual(
      await db.query("SELECT * FROM inventory ORDER BY variant_id,branch_id"),
      alteredStock,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::integer AS count FROM seed_migrations WHERE version='demo-catalog-500-v1'",
        )
      )[0]!.count,
      1,
    );
    await db.exec("DROP SCHEMA core_seed_upgrade_test CASCADE");
  });
});

test("store promotions require translated copy and safe local links and media", async () => {
  const previous = await core.getSettings();
  const text = { ru: "Новинки", kk: "Жаңалықтар", en: "New arrivals" };
  try {
    const updated = await core.updateSettings(actorId, {
      ...previous,
      announcement: { enabled: true, text, href: "/ru/catalog?category=shoes" },
      banner: {
        enabled: true,
        title: text,
        imageUrl: `/api/media/${"a".repeat(64)}.webp`,
      },
    });
    assert.deepEqual(
      (await core.getSettings()).announcement,
      updated.announcement,
    );
    for (const href of [
      "https://example.test",
      "javascript:alert(1)",
      "//example.test",
      "/\\example.test",
      "/%2fexample.test",
      "/%255cexample.test",
      "/x\ny",
    ]) {
      await assert.rejects(
        () =>
          core.updateSettings(actorId, {
            ...previous,
            announcement: { enabled: true, text, href },
          }),
        core.CoreError,
      );
    }
    await assert.rejects(
      () =>
        core.updateSettings(actorId, {
          ...previous,
          announcement: { enabled: true, text: { ...text, kk: " " } },
        }),
      core.CoreError,
    );
    await assert.rejects(
      () =>
        core.updateSettings(actorId, {
          ...previous,
          banner: {
            enabled: true,
            title: text,
            imageUrl: "https://example.test/banner.webp",
          },
        }),
      core.CoreError,
    );
    const disabled = await core.updateSettings(actorId, {
      ...previous,
      announcement: { enabled: false, text: { ru: "", kk: "", en: "" } },
    });
    assert.equal(disabled.announcement?.enabled, false);
  } finally {
    await core.updateSettings(actorId, previous);
  }
});

test("owner content pages persist empty translations and edited plain text with a strict page structure", async () => {
  const previous = await core.getSettings();
  try {
    const empty = { ru: "", kk: "", en: "" };
    const about = {
      ru: "О магазине\nАдрес и команда",
      kk: "Дүкен туралы",
      en: "About the store",
    };
    await core.updateSettings(actorId, {
      ...previous,
      contentPages: { about: empty, privacy: empty },
    });
    assert.deepEqual((await core.getSettings()).contentPages?.about, empty);
    await core.updateSettings(actorId, {
      ...previous,
      contentPages: { about, privacy: empty },
    });
    assert.deepEqual((await core.getSettings()).contentPages, {
      about,
      privacy: empty,
    });
    for (const contentPages of [
      { unknown: empty },
      { about: { ...empty, extra: "unsupported" } },
      { about: { ru: "Missing language", en: "Incomplete" } },
      { about: { ...empty, ru: { html: "unsupported" } } },
      { about: { ...empty, en: "x".repeat(20001) } },
    ]) {
      await assert.rejects(
        () =>
          core.updateSettings(actorId, {
            ...previous,
            contentPages,
          } as unknown as Settings),
        core.CoreError,
      );
    }
  } finally {
    await core.updateSettings(actorId, previous);
  }
});

test("product details and promotion persist while public projection omits disabled fields", async () => {
  const products = await core.getStaffProducts(actorId);
  const original = products.find((product) => product.slug === "city-tee")!;
  assert.equal(original.details.length, 6);
  const detail = {
    key: "composition",
    label: { ru: "Состав", kk: "Құрамы", en: "Composition" },
    value: { ru: "Хлопок", kk: "Мақта", en: "Cotton" },
    enabled: false,
  };
  const promotion = {
    enabled: true,
    label: { ru: "Акция", kk: "Акция", en: "Offer" },
    percent: 15,
  };
  const updated = await core.upsertProduct(actorId, {
    ...original,
    details: [detail],
    promotion,
  });
  assert.deepEqual(updated.details, [detail]);
  assert.equal(updated.promotion?.percent, 15);
  assert.deepEqual(core.publicProduct(updated).details, []);
  assert.equal(core.publicProduct(updated).promotion?.percent, 15);
  const hidden = await core.upsertProduct(actorId, {
    ...updated,
    promotion: { ...promotion, enabled: false },
  });
  assert.equal("promotion" in core.publicProduct(hidden), false);
  assert.equal(hidden.promotion?.label.en, "Offer");
  await assert.rejects(
    core.upsertProduct(actorId, {
      ...hidden,
      promotion: { ...promotion, percent: 100 },
    }),
    { code: "VALIDATION" },
  );
  await assert.rejects(
    core.upsertProduct(actorId, { ...hidden, details: [detail, detail] }),
    { code: "VALIDATION" },
  );
  await core.upsertProduct(actorId, original);
});

test("enriched catalog migration is idempotent and preserves staff edits", async () => {
  const { seed } = await import("../src/seed");
  const db = await database();
  const enriched = await db.query(
    "SELECT id FROM products WHERE jsonb_array_length(details)=6",
  );
  assert.equal(enriched.length, 15);
  await db.query(
    "UPDATE products SET description=$1::jsonb WHERE id='demo-essential-tee'",
    [
      JSON.stringify({
        ru: "Описание сотрудника",
        kk: "Қызметкер сипаттамасы",
        en: "Staff description",
      }),
    ],
  );
  await db.query(
    "DELETE FROM seed_migrations WHERE version='product-details-15-v1'",
  );
  await seed(db);
  const [edited] = await db.query(
    "SELECT description,details FROM products WHERE id='demo-essential-tee'",
  );
  assert.equal(edited.description.en, "Staff description");
  assert.equal(edited.details.length, 6);
  await seed(db);
  assert.equal(
    (
      await db.query(
        "SELECT id FROM products WHERE jsonb_array_length(details)=6",
      )
    ).length,
    15,
  );
});

test("staff product identifiers persist, reject invalid barcodes and can be cleared", async () => {
  const input = {
    slug: "identifiers-test", category: "accessories", gender: "unisex", brand: "Test",
    names: { ru: "Товар", kk: "Тауар", en: "Product" }, price: 10000,
    media: [], isDemo: false, published: false,
    sizes: [{ size: "ONE SIZE", color: "Black", barcode: "4006381333931" }], article: "SKU-123",
  };
  const created = await core.upsertProduct(actorId, input);
  assert.equal(created.article, "SKU-123");
  assert.equal(created.sizes[0]?.barcode, "4006381333931");
  const projected = (await core.getStaffProducts(actorId)).find(p => p.id === created.id)!;
  assert.equal(projected.sizes[0]?.barcode, "4006381333931");
  await assert.rejects(core.upsertProduct(actorId, { ...projected, sizes: [{ ...projected.sizes[0], barcode: "4006381333932" }] }), { code: "VALIDATION" });
  const cleared = await core.upsertProduct(actorId, { ...projected, article: null, sizes: [{ ...projected.sizes[0], barcode: null }] });
  assert.equal("article" in cleared, false);
  assert.equal("barcode" in cleared.sizes[0]!, false);
});


test("published slug batches preserve requested order, hydrate stock, deduplicate and enforce bounds", async () => {
  const db = await database();
  await db.query(`INSERT INTO products(id,slug,category,gender,brand,names,description,price,published)
    SELECT 'batch-'||name,'batch-'||name,'hoodies','unisex','Test','{"ru":"Товар","kk":"Тауар","en":"Product"}','{}',100,name<>'hidden'
    FROM unnest(ARRAY['alpha','beta','hidden']) name`);
  await db.query("INSERT INTO variants(id,product_id,size,color) VALUES('batch-alpha-variant','batch-alpha','M','Black'),('batch-beta-variant','batch-beta','S','Black')");
  await db.query("INSERT INTO inventory(variant_id,branch_id,quantity,reserved) VALUES('batch-alpha-variant','one',4,1),('batch-alpha-variant','two',2,0)");
  const products = await core.getPublishedProductsBySlugs(['batch-beta','missing-batch','batch-hidden','batch-alpha','batch-beta']);
  assert.deepEqual(products.map((product) => product.slug),['batch-beta','batch-alpha']);
  assert.equal(products[0].sizes[0].available,0);
  assert.equal(products[1].sizes[0].available,5);
  assert.deepEqual(await core.getPublishedProductsBySlugs([]),[]);
  for (const slugs of [Array.from({length:25},(_,index)=>`batch-${index}`),['../batch-alpha'],[''],['Batch-alpha'],['x'.repeat(201)]])
    await assert.rejects(core.getPublishedProductsBySlugs(slugs),{code:'VALIDATION'});
});
