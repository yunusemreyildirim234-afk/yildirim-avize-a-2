import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyStatusChangeInTx, applyUndoInTx } from "../lib/order-undo.ts";
import { deliverySummary } from "../lib/order-display.ts";

function fakeTx(status) {
  const state = { status, stockDeducted: false, couponCode: null, writes: [] };
  return {
    state,
    order: {
      findUnique: async () => ({ status: state.status, stockDeducted: state.stockDeducted, couponCode: null }),
      updateMany: async ({ where, data }) => {
        if (where.status !== undefined && where.status !== state.status) return { count: 0 };
        state.writes.push(data);
        Object.assign(state, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async () => [] },
  };
}
const noop = async () => {};

test("SHIPPED → DELIVERED teslim anını yazar", async () => {
  const tx = fakeTx("SHIPPED");
  const r = await applyStatusChangeInTx(tx, "o1", "DELIVERED", noop);
  assert.equal(r.outcome, "OK");
  assert.ok(tx.state.writes[0].deliveredAt instanceof Date);
});

test("DELIVERED dışı geçişte deliveredAt gönderilmez; DELIVERED → RETURNED'de korunur", async () => {
  const a = fakeTx("PENDING");
  await applyStatusChangeInTx(a, "o1", "SHIPPED", noop);
  assert.ok(!("deliveredAt" in a.state.writes[0]));
  const b = fakeTx("DELIVERED");
  const r = await applyStatusChangeInTx(b, "o1", "RETURNED", noop);
  assert.equal(r.outcome, "OK");
  assert.ok(!("deliveredAt" in b.state.writes[0]));
});

test("teslim geri alınınca deliveredAt null olur, diğer geri almada yazılmaz", async () => {
  const deps = { deduct: async () => true, reserve: async () => true };
  const a = fakeTx("DELIVERED");
  await applyUndoInTx(a, { orderId: "o1", from: "SHIPPED", to: "DELIVERED", restoredStock: false, coupon: null }, deps);
  assert.equal(a.state.writes[0].deliveredAt, null);
  assert.equal(a.state.status, "SHIPPED");
  const b = fakeTx("SHIPPED");
  await applyUndoInTx(b, { orderId: "o1", from: "PENDING_NEW", to: "SHIPPED", restoredStock: false, coupon: null }, deps);
  assert.ok(!("deliveredAt" in b.state.writes[0]));
});

test("markDelivered tek koşullu updateMany ile deliveredAt yazar (SHIPPED koşulu korunur)", () => {
  const src = readFileSync(new URL("../lib/shipment-sync.ts", import.meta.url), "utf8");
  assert.match(src, /status: "SHIPPED"[^]*data: \{ status: "DELIVERED", deliveredAt: new Date\(\)/);
});

test("yönetici bilgi satırı: kalan gün, bugün, süre doldu, kayıt yok", () => {
  const d = new Date("2026-11-10T10:00:00Z");
  assert.equal(deliverySummary(d, new Date("2026-11-14T12:00:00Z"), "10.11.2026"), "Teslim: 10.11.2026 · 4 gün önce (cayma süresi: 10 gün kaldı)");
  assert.match(deliverySummary(d, new Date("2026-11-10T12:00:00Z"), "10.11.2026"), /bugün/);
  assert.match(deliverySummary(d, new Date("2026-12-01T10:00:00Z"), "10.11.2026"), /cayma süresi doldu/);
  assert.equal(deliverySummary(null, new Date(), ""), null);
});
