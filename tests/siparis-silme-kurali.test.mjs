import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOrderDeletable, DELETE_GUARD_HOURS } from "../lib/stock-rules.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const H = 3_600_000;
const o = (status, hoursAgo = 100) => ({ status, createdAt: new Date(NOW - hoursAgo * H) });

test("silinebilir: ödeme başarısız, iptal, süresi geçmiş ödeme bekleyen", () => {
  assert.equal(isOrderDeletable(o("PAYMENT_FAILED", 0), NOW), true);
  assert.equal(isOrderDeletable(o("CANCELLED", 0), NOW), true);
  assert.equal(isOrderDeletable(o("AWAITING_PAYMENT", DELETE_GUARD_HOURS + 1), NOW), true);
});

test("silinemez: taze ödeme bekleyen, ödenmiş, hazırlanan, kargodaki, teslim, iade", () => {
  assert.equal(isOrderDeletable(o("AWAITING_PAYMENT", 0.5), NOW), false);
  for (const s of ["PENDING_NEW", "PENDING", "PREPARING", "SHIPPED", "DELIVERED", "RETURNED"]) {
    assert.equal(isOrderDeletable(o(s), NOW), false, s);
  }
});

test("silme ucu bu kuralı kullanır ve 409 döner", () => {
  const s = readFileSync(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8");
  assert.match(s, /isOrderDeletable\(o, Date\.now\(\)\)/);
  assert.match(s, /silinebilir durumda değil/);
});
