import { test } from "node:test";
import assert from "node:assert/strict";
import { walletInvoiceStatus } from "./wallet-status.js";

test("wallet polling repairs terminal errors when the webhook was missed", () => {
  for (const status of [
    "paid",
    "cancelled",
    "expired",
    "error",
    "partially_refunded",
  ])
    assert.equal(walletInvoiceStatus({ id: "fixture", status }), status);
  assert.equal(
    walletInvoiceStatus({ id: "fixture", status: "pending" }),
    undefined,
  );
  assert.equal(
    walletInvoiceStatus({ id: "fixture", status: "processing" }),
    undefined,
  );
});
test("wallet polling gives completed and cumulative refunds priority over invoice status", () => {
  assert.equal(
    walletInvoiceStatus({
      id: "fixture",
      status: "paid",
      total_refunded: "500.00",
    }),
    "partially_refunded",
  );
  assert.equal(
    walletInvoiceStatus({
      id: "fixture",
      status: "error",
      total_refunded: "1000.00",
      is_fully_refunded: true,
    }),
    "refunded",
  );
});
