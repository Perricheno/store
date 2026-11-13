import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@urbanmag/core";
import { HISTORY_DAYS, HISTORY_LIMIT, emptyHistory, parseHistory, recordView, rankSuggestions, findOwnOrder, orderFingerprint, parseReadMarkers } from "../apps/web/src/lib/buyer-device";
import { buyerOrderStatus } from "../apps/web/src/lib/buyer-status";
const now = Date.UTC(2026, 10, 14);
const product = (slug: string, category = "t-shirts", available = 3): Product => ({
  id: slug, slug, category, published: true, sizes: [{ id: `${slug}-m`, size: "M", color: "black", available }],
} as Product);

test("device history expires, deduplicates, limits and rejects malformed data", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ slug: `item-${i}`, category: "t-shirts", viewedAt: now - i }));
  const parsed = parseHistory(JSON.stringify({ enabled: true, entries: [
    ...entries, entries[0], { slug: "expired", category: "t-shirts", viewedAt: now - HISTORY_DAYS * 86400000 },
    { slug: "future", category: "t-shirts", viewedAt: now + 1 }, { slug: "bad/path", category: "t-shirts", viewedAt: now },
  ] }), now);
  assert.equal(parsed.entries.length, HISTORY_LIMIT);
  assert.equal(new Set(parsed.entries.map((entry) => entry.slug)).size, HISTORY_LIMIT);
  assert.equal(parsed.entries[0].slug, "item-0");
  assert.deepEqual(parseHistory("broken", now), emptyHistory());
  assert.deepEqual(parseHistory(JSON.stringify({ enabled: false, entries }), now), { enabled: false, entries: [] });
});

test("recording preserves disabled preference and stores only minimal fields", () => {
  assert.deepEqual(recordView({ enabled: false, entries: [] }, product("city"), now), { enabled: false, entries: [] });
  const first = recordView(emptyHistory(), product("city"), now);
  const again = recordView(first, product("city"), now + 1);
  assert.deepEqual(again.entries, [{ slug: "city", category: "t-shirts", viewedAt: now + 1 }]);
  assert.deepEqual(Object.keys(again.entries[0]).sort(), ["category", "slug", "viewedAt"]);
});

test("suggestions use real relevant stock, exclude seen and saved, and rank deterministically", () => {
  const viewed = [{ slug: "seen", category: "t-shirts", viewedAt: now }];
  const saved = [product("favorite", "hoodies")];
  const products = [product("seen"), product("irrelevant", "shoes"), product("out", "hoodies", 0),
    product("tee"), product("hoodie-b", "hoodies"), product("hoodie-a", "hoodies"), product("favorite", "hoodies")];
  const result = rankSuggestions([...products, products[3]], viewed, saved);
  assert.deepEqual(result.map((item) => item.slug), ["hoodie-a", "hoodie-b", "tee"]);
  assert.deepEqual(rankSuggestions([...products].reverse(), viewed, saved), result);
  assert.deepEqual(rankSuggestions(products, [], []), []);
});

test("order checking searches only own supplied orders and rejects ambiguity or partial guesses", () => {
  const orders = [{ id: "aaaaaaaa-1111", number: "AAAAAAAA" }, { id: "bbbbbbbb-2222" }];
  assert.equal(findOwnOrder(orders, "#aaaaaaaa"), orders[0]);
  assert.equal(findOwnOrder(orders, " bbbbbbbb-2222 "), orders[1]);
  assert.equal(findOwnOrder(orders, "aaaa"), undefined);
  assert.equal(findOwnOrder(orders, "other-user-order"), undefined);
  assert.equal(findOwnOrder(orders, ""), undefined);
  assert.equal(findOwnOrder([...orders, { id: "aaaaaaaa-9999" }], "aaaaaaaa"), undefined);
});

test("read markers are bounded, contain no order details and become stale when status changes", () => {
  const paid = orderFingerprint({ status: "paid", paymentStatus: "paid" });
  assert.notEqual(orderFingerprint({ status: "ready", paymentStatus: "paid" }), paid);
  assert.deepEqual(parseReadMarkers(JSON.stringify({ "order-1": paid, invalid: { email: "private@example.test" }, "bad/path": "paid:paid" })), { "order-1": paid });
  assert.equal(Object.keys(parseReadMarkers(JSON.stringify(Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`order-${i}`, paid]))))).length, 200);
});

test("fulfillment and refunds take precedence over historical paid status in every language", () => {
  for (const locale of ["ru", "kk", "en"] as const) {
    const paid = buyerOrderStatus({ status: "paid", paymentStatus: "paid" }, locale);
    for (const status of ["processing", "ready", "completed", "refund_required", "manual_review", "expired"]) {
      assert.notEqual(buyerOrderStatus({ status, paymentStatus: "paid" }, locale), paid);
    }
    assert.notEqual(buyerOrderStatus({ status: "paid", paymentStatus: "refunded" }, locale), paid);
  }
});
