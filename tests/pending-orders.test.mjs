import test from "node:test";
import assert from "node:assert/strict";
import { isStaleReservation, reservationExpiresAt, RESERVATION_HOLD_MINUTES, PAYTR_TIMEOUT_MINUTES, ABANDONED_CARD_MINUTES } from "../lib/stock-rules.ts";
import { planPendingCleanup, MAX_PENDING_PER_CONTACT } from "../lib/pending-orders.ts";
import { restoreStockInTx } from "../lib/stock-restore.ts";

const T0 = Date.parse("2026-11-04T10:00:00Z");
const min = (m) => m * 60_000;

test("tutma süresi 15 dk; PayTR ödeme sayfası ondan kısa kapanır", () => {
  assert.equal(RESERVATION_HOLD_MINUTES, 15);
  assert.ok(PAYTR_TIMEOUT_MINUTES < RESERVATION_HOLD_MINUTES);
  assert.equal(ABANDONED_CARD_MINUTES, 15);
  assert.equal(reservationExpiresAt(new Date(T0)).getTime(), T0 + min(15));
});

test("süresi dolan bekleyen sipariş serbest kalır, süresi içindeki kalmaz", () => {
  assert.equal(isStaleReservation(new Date(T0), T0 + min(15)), false); // tam 15. dk hâlâ ayrılı
  assert.equal(isStaleReservation(new Date(T0), T0 + min(15) + 1), true);
  assert.equal(isStaleReservation(new Date(T0), T0 + min(5)), false);
});

test("çift serbest bırakma stoğu iki kez artırmaz", async () => {
  let flag = true;
  let stock = 7;
  const tx = {
    order: { updateMany: async () => { if (flag) { flag = false; return { count: 1 }; } return { count: 0 }; } },
    orderItem: { findMany: async () => [{ variationId: "v1", quantity: 3 }] },
    productVariation: { update: async (a) => { stock += a.data.stock.increment; } },
  };
  await restoreStockInTx(tx, "o1");
  await restoreStockInTx(tx, "o1");
  assert.equal(stock, 10);
});

const row = (id, email, phone, over = {}) => ({ id, phone, userId: over.userId ?? "u-" + email, user: { email, password: over.password ?? "guest_checkout" } });

test("aynı e-postalı eski bekleyen sipariş iptal edilir (misafir etiketi dahil)", () => {
  const rows = [row("a", "ali@x.com", "0555 111 22 33"), row("b", "ali+misafirab12@x.com", "05551112233"), row("c", "veli@x.com", "0532 000 00 00")];
  const r = planPendingCleanup(rows, { email: "Ali@X.com", phone: "0 555 999 88 77" });
  assert.deepEqual(r.cancelIds.sort(), ["a", "b"]);
  assert.equal(r.blocked, false);
});

test("kayıtlı hesabın bekleyen siparişi oturumsuz iptal edilmez; oturumla edilir", () => {
  const rows = [row("a", "ali@x.com", "0555 111 22 33", { password: "hash", userId: "U1" })];
  assert.deepEqual(planPendingCleanup(rows, { email: "ali@x.com", phone: "0555 000 00 00" }).cancelIds, []);
  assert.deepEqual(planPendingCleanup(rows, { email: "ali@x.com", phone: "0555 000 00 00", sessionUserId: "U1" }).cancelIds, ["a"]);
});

test("aynı telefonla farklı e-postalardan bekleyen sayısı sınıra gelince engellenir", () => {
  const phone = "0555 111 22 33";
  const one = [row("a", "a@x.com", phone)];
  assert.equal(planPendingCleanup(one, { email: "n@x.com", phone }).blocked, false);
  const two = [row("a", "a@x.com", phone), row("b", "b@x.com", "+90 555 111 22 33")];
  assert.equal(MAX_PENDING_PER_CONTACT, 2);
  assert.equal(planPendingCleanup(two, { email: "n@x.com", phone }).blocked, true);
  assert.equal(planPendingCleanup(two, { email: "n@x.com", phone: "0532 999 99 99" }).blocked, false);
});
