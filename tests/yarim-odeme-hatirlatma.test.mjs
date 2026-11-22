import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abandonedCardWhere, shouldSendAbandonedReminder, PAID_ORDER_STATUSES } from "../lib/abandoned-card.ts";

const NOW = Date.parse("2026-11-22T09:00:00Z");
const H = 3_600_000;

test("sorgu: bekleyen + başarısız, kartlı, gönderilmemiş, 2 saat–7 gün", () => {
  const w = abandonedCardWhere(NOW);
  assert.deepEqual(w.status.in, ["AWAITING_PAYMENT", "PAYMENT_FAILED"]);
  assert.equal(w.paymentMethod, "CREDIT_CARD");
  assert.equal(w.abandonedEmailSent, false);
  assert.equal(w.createdAt.lt.getTime(), NOW - 2 * H);
  assert.equal(w.createdAt.gt.getTime(), NOW - 7 * 24 * H);
});

test("sonradan ödenmiş sipariş varsa atlanır; önceki ödenmiş veya ödenmemiş sipariş engellemez", () => {
  const o = { createdAt: new Date(NOW - 5 * H) };
  assert.equal(shouldSendAbandonedReminder(o, []), true);
  assert.equal(shouldSendAbandonedReminder(o, [{ status: "PENDING", createdAt: new Date(NOW - 1 * H) }]), false);
  assert.equal(shouldSendAbandonedReminder(o, [{ status: "DELIVERED", createdAt: new Date(NOW - 4 * H) }]), false);
  assert.equal(shouldSendAbandonedReminder(o, [{ status: "PENDING", createdAt: new Date(NOW - 9 * H) }]), true);
  assert.equal(shouldSendAbandonedReminder(o, [{ status: "PAYMENT_FAILED", createdAt: new Date(NOW - 1 * H) }, { status: "CANCELLED", createdAt: new Date(NOW - 1 * H) }]), true);
  assert.ok(!PAID_ORDER_STATUSES.includes("PENDING_NEW"));
});

test("cron bu kuralı kullanır; onay kuralı ve e-posta çağrıları korunur", () => {
  const s = readFileSync(new URL("../app/api/cron/reminders/route.ts", import.meta.url), "utf8");
  assert.match(s, /abandonedCardWhere\(now\)/);
  assert.match(s, /shouldSendAbandonedReminder/);
  assert.match(s, /hasActiveConsent\(to\)/);
  assert.match(s, /sendCartReminderEmail/);
});
