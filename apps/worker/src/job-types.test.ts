import { test } from "node:test";
import assert from "node:assert/strict";
import { availableJobTypes } from "./job-types.js";

test("each configured integration enables only its own jobs", () => {
  assert.deepEqual(availableJobTypes(false, false), []);
  assert.deepEqual(availableJobTypes(false, true), ["send_mail"]);
  assert.deepEqual(availableJobTypes(true, false), ["create_invoice", "create_wallet_topup_invoice"]);
  assert.deepEqual(availableJobTypes(true, true), ["create_invoice", "create_wallet_topup_invoice", "send_mail"]);
});
