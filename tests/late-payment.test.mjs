import test from "node:test";
import assert from "node:assert/strict";
import { buildLatePaymentEmail, reportLatePayment } from "../lib/late-payment.ts";

const order = { totalAmount: 1234.5, customerName: "Ali <b>Veli</b>", phone: "0555 111 22 33" };
const info = (orderStatus, payStatus = "success") => ({ merchantOid: "OID1", orderId: "abcdef12-3456", orderStatus, payStatus, siteUrl: "https://x.test" });
const mkDeps = (over = {}) => {
  const calls = { panel: 0, mail: [] };
  return {
    calls,
    deps: {
      log: () => {},
      warn: () => {},
      notifyAdmins: async () => { calls.panel++; },
      loadOrder: async () => order,
      emailAdmin: async (m) => { calls.mail.push(m); return true; },
      ...over,
    },
  };
};

test("e-posta konusu ve gövdesi: numara, durum, tutar, müşteri, telefon, yönlendirme, bağlantı", () => {
  const m = buildLatePaymentEmail({ orderId: "abcdef12-3456", orderStatus: "PAYMENT_FAILED", merchantOid: "OID1", siteUrl: "https://x.test", order });
  assert.equal(m.subject, "Ödeme alındı ama sipariş iptal/başarısız: #abcdef12");
  for (const s of ["abcdef12-3456", "PAYMENT_FAILED", "1.234,50", "0555 111 22 33", "PayTR panelinden iade edin", "https://x.test/admin#siparisler"]) assert.ok(m.html.includes(s), s);
  assert.ok(!m.html.includes("<b>Veli"), "müşteri adı kaçışlanmalı");
});

test("sipariş okunamazsa gövde yine üretilir", () => {
  const m = buildLatePaymentEmail({ orderId: "abcdef12-3456", orderStatus: "CANCELLED", merchantOid: "OID1", siteUrl: "https://x.test", order: null });
  assert.ok(m.html.includes("okunamadı"));
});

test("CANCELLED/PAYMENT_FAILED success: panel + e-posta gider", async () => {
  for (const st of ["CANCELLED", "PAYMENT_FAILED"]) {
    const { deps, calls } = mkDeps();
    assert.equal(await reportLatePayment(deps, info(st)), true);
    assert.equal(calls.panel, 1);
    assert.equal(calls.mail.length, 1);
  }
});

test("yinelenen bildirimde (PENDING, SHIPPED, READY_FOR_PICKUP, DELIVERED) ve success dışında e-posta/panel yok", async () => {
  for (const st of ["PENDING", "SHIPPED", "READY_FOR_PICKUP", "DELIVERED"]) {
    const { deps, calls } = mkDeps();
    assert.equal(await reportLatePayment(deps, info(st)), false);
    assert.equal(calls.panel + calls.mail.length, 0);
  }
  const { deps, calls } = mkDeps();
  assert.equal(await reportLatePayment(deps, info("CANCELLED", "failed")), false);
  assert.equal(calls.panel + calls.mail.length, 0);
});

test("e-posta hata verirse panel bildirimi yazılmış olur ve fonksiyon hata fırlatmaz", async () => {
  const { deps, calls } = mkDeps({ emailAdmin: async () => { throw new Error("resend down"); } });
  assert.equal(await reportLatePayment(deps, info("CANCELLED")), true);
  assert.equal(calls.panel, 1);
});

test("panel bildirimi hata verse de e-posta denenir", async () => {
  const { deps, calls } = mkDeps({ notifyAdmins: async () => { throw new Error("db"); } });
  assert.equal(await reportLatePayment(deps, info("CANCELLED")), true);
  assert.equal(calls.mail.length, 1);
});

test("e-posta yavaşsa zaman aşımıyla döner (callback bekletilmez)", async () => {
  const { deps, calls } = mkDeps({ emailAdmin: () => new Promise(() => {}) });
  const t0 = Date.now();
  assert.equal(await reportLatePayment(deps, info("CANCELLED")), true);
  assert.equal(calls.panel, 1);
  assert.ok(Date.now() - t0 < 6000);
});
