import test from "node:test";
import assert from "node:assert/strict";
import { PURCHASE_EXCLUDED_STATUSES, isPurchasable } from "../lib/gtm-events.ts";

test("ödemesi gelmemiş havale (PENDING_NEW) için purchase atılmaz", () => {
  assert.ok(PURCHASE_EXCLUDED_STATUSES.includes("PENDING_NEW"));
  assert.equal(isPurchasable("PENDING_NEW"), false);
});

test("ödenmiş kartlı sipariş (PENDING) ve sonraki durumlar purchase atar", () => {
  for (const s of ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"]) assert.equal(isPurchasable(s), true, s);
});

test("diğer hariç durumlar aynı kaldı", () => {
  for (const s of ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"]) assert.equal(isPurchasable(s), false, s);
});
