import test from "node:test";
import assert from "node:assert/strict";
import { MISSING_ORDER_STATUS, finalizeOrReport, reportLatePayment } from "../lib/late-payment.ts";

// PayTR callback çekirdeği: "durumu oku" ile "sahiplen" arasına başka bir işlem girerse ödeme sessizce kaybolmamalı.
const mk = (order) => {
  const alerts = [];
  const lateDeps = { log: () => {}, warn: () => {}, notifyAdmins: async (n) => { alerts.push(n.title); }, loadOrder: async () => null, emailAdmin: async () => true };
  return {
    alerts,
    deps: {
      // lib/orders.ts finalizeOrder ile aynı koşullu sahiplenme
      finalize: async () => {
        if (!order.row || !["AWAITING_PAYMENT", "PENDING_NEW"].includes(order.row.status)) return false;
        order.row.status = "PENDING";
        return true;
      },
      readStatus: async () => order.row?.status ?? null,
      report: (orderStatus) => reportLatePayment(lateDeps, { merchantOid: "OID1", orderId: "abcdef12-3456", orderStatus, payStatus: "success", siteUrl: "https://x.test" }),
    },
  };
};

test("bulgu 1: sipariş ödeme bekliyorsa sahiplenilir, uyarı üretilmez", async () => {
  const order = { row: { status: "AWAITING_PAYMENT" } };
  const { deps, alerts } = mk(order);
  assert.equal(await finalizeOrReport(deps), "FINALIZED");
  assert.equal(order.row.status, "PENDING");
  assert.deepEqual(alerts, []);
});

test("bulgu 1: callback durumu okuduktan sonra sipariş kapatılırsa geç ödeme uyarısı üretilir", async () => {
  for (const closed of ["PAYMENT_FAILED", "CANCELLED"]) {
    const order = { row: { status: "AWAITING_PAYMENT" } }; // callback bu durumu okudu
    const { deps, alerts } = mk(order);
    order.row.status = closed; // araya giren istek (bayat bırakma / yeni sipariş denemesi / cron / yönetici)
    assert.equal(await finalizeOrReport(deps), "LATE");
    assert.equal(order.row.status, closed, "durum değiştirilmez");
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes(closed));
  }
});

test("bulgu 1: eşzamanlı ikinci success bildirimi (sipariş zaten PENDING) uyarı üretmez", async () => {
  const order = { row: { status: "AWAITING_PAYMENT" } };
  const a = mk(order);
  const b = mk(order);
  assert.equal(await finalizeOrReport(a.deps), "FINALIZED");
  assert.equal(await finalizeOrReport(b.deps), "LATE");
  assert.deepEqual(b.alerts, [], "PENDING zararsız yinelemedir");
});

test("bulgu 1: sahiplenme kaybedilip sipariş de silinmişse 'kayıt yok' uyarısı; durum okunamazsa yine uyarı", async () => {
  const order = { row: null };
  const { deps, alerts } = mk(order);
  assert.equal(await finalizeOrReport(deps), "LATE");
  assert.ok(alerts[0].includes(MISSING_ORDER_STATUS));
  const broken = mk({ row: { status: "CANCELLED" } });
  broken.deps.readStatus = async () => { throw new Error("db"); };
  assert.equal(await finalizeOrReport(broken.deps), "LATE");
  assert.equal(broken.alerts.length, 1);
});
