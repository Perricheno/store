import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiPay, configuredApiPay } from "./apipay.js";

test("missing provider credentials pause queue processing without relaxing mode validation", () => {
  assert.deepEqual(configuredApiPay("production", "", "production"), {
    mode: "production",
    api: null,
  });
  assert.equal(configuredApiPay("sandbox", "  ", "development").api, null);
  assert.throws(() => configuredApiPay("invalid", "", "production"), /Invalid APIPAY_MODE/);
  assert.throws(() => configuredApiPay("mock", "", "production"), /forbidden in production/);
  assert.throws(() => new ApiPay("production", ""), /APIPAY_API_KEY is required/);
  assert.ok(configuredApiPay("sandbox", "key", "development").api);
});

test("sandbox mode is checked before creating an idempotent whole-tenge invoice", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request = (async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify(
        calls.length === 1
          ? { mode: "sandbox" }
          : { id: 123, status: "processing" },
      ),
      { status: calls.length === 1 ? 200 : 201 },
    );
  }) as typeof fetch;
  const api = new ApiPay("sandbox", "secret", "https://example.test", request);
  assert.deepEqual(
    await api.create({
      id: "order-1",
      phone: "77071234567",
      total: 1500,
      isDemo: true,
    }),
    { id: "123", status: "processing" },
  );
  const body = JSON.parse(String(calls[1].init?.body));
  assert.equal(body.amount, 1500);
  assert.equal(body.external_order_id_idempotency, "order-1");
  assert.equal(calls[0].url, "https://example.test/account/health");
});
test("wrong account mode blocks invoice creation", async () => {
  let calls = 0;
  const request = (async () => {
    calls++;
    return new Response(JSON.stringify({ mode: "production" }));
  }) as typeof fetch;
  const api = new ApiPay("sandbox", "key", "https://example.test", request);
  await assert.rejects(() =>
    api.create({ id: "x", phone: "7", total: 1, isDemo: false }),
  );
  assert.equal(calls, 1);
});
test("duplicate idempotency response recovers existing invoice", async () => {
  const request = (async (url: any) =>
    String(url).endsWith("/account/health")
      ? new Response(JSON.stringify({ mode: "sandbox" }))
      : new Response(
          JSON.stringify({
            error_code: "duplicate_idempotency_key",
            invoice_id: 7,
            status: "pending",
          }),
          { status: 409 },
        )) as typeof fetch;
  const api = new ApiPay("sandbox", "key", "https://example.test", request);
  assert.deepEqual(
    await api.create({ id: "x", phone: "7", total: 1, isDemo: false }),
    { id: "7", status: "pending" },
  );
});
test("generic wallet invoice preserves its own ID, amount and bounded description", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request = (async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify(
        calls.length === 1
          ? { mode: "sandbox" }
          : { id: 456, status: "processing" },
      ),
      { status: calls.length === 1 ? 200 : 201 },
    );
  }) as typeof fetch;
  const api = new ApiPay(
    "sandbox",
    "test-key",
    "https://example.test",
    request,
  );
  assert.deepEqual(
    await api.createInvoice({
      externalId: "topup-uuid",
      phone: "+77011234567",
      amount: 2000,
      isDemo: false,
      description: "Urbanmag balance " + "a".repeat(80),
    }),
    { id: "456", status: "processing" },
  );
  const payload = JSON.parse(String(calls[1]!.init?.body));
  assert.equal(payload.external_order_id, "topup-uuid");
  assert.equal(payload.external_order_id_idempotency, "topup-uuid");
  assert.equal(payload.amount, 2000);
  assert.equal(payload.description.length, 60);
  assert.equal(payload.phone_number, "+77011234567");
  assert.equal("simulate" in payload, false);
});
test("generic invoice blocks fractional money and production demo items before network access", async () => {
  let calls = 0;
  const request = (async () => {
    calls++;
    return new Response("{}");
  }) as typeof fetch;
  const api = new ApiPay(
    "production",
    "test-key",
    "https://example.test",
    request,
  );
  const data = {
    externalId: "topup-uuid",
    phone: "+77011234567",
    amount: 1,
    isDemo: false,
    description: "Urbanmag balance",
  };
  await assert.rejects(
    api.createInvoice({ ...data, amount: 1.5 }),
    /whole tenge/,
  );
  await assert.rejects(
    api.createInvoice({ ...data, isDemo: true }),
    /Demo orders/,
  );
  assert.equal(calls, 0);
});
