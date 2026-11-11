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

// ---- Bulgu 2: silinmiş siparişe gelen ödeme + ödeme bekleyen siparişin silinmesi ----
import { DELETE_GUARD_HOURS, isPaymentInFlight } from "../lib/stock-rules.ts";

test("bulgu 2: sipariş kaydı yokken success uyarı üretir; failed üretmez; aynı işlem no ikinci kez uyarmaz", async () => {
  const alerts = [];
  const seen = new Set();
  const deps = { log: () => {}, warn: () => {}, notifyAdmins: async (n) => { alerts.push(n); }, loadOrder: async () => null, emailAdmin: async () => true, alreadyReported: async (oid) => seen.has(oid) };
  const info = { merchantOid: "OID9", orderId: "abcdef12-3456", orderStatus: MISSING_ORDER_STATUS, siteUrl: "https://x.test" };
  assert.equal(await reportLatePayment(deps, { ...info, payStatus: "failed" }), false);
  assert.equal(alerts.length, 0);
  assert.equal(await reportLatePayment(deps, { ...info, payStatus: "success" }), true);
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].title.includes(MISSING_ORDER_STATUS) && alerts[0].message.includes("OID9"));
  seen.add("OID9"); // PayTR aynı bildirimi yineler
  assert.equal(await reportLatePayment(deps, { ...info, payStatus: "success" }), false);
  assert.equal(alerts.length, 1);
});

test("bulgu 2: ödeme bekleyen sipariş son 2 saatte oluşturulduysa silinemez; eski veya başka durumdaki silinebilir", () => {
  const now = Date.UTC(2026, 0, 1, 12);
  const ago = (min) => new Date(now - min * 60_000);
  assert.equal(DELETE_GUARD_HOURS, 2);
  assert.equal(isPaymentInFlight({ status: "AWAITING_PAYMENT", createdAt: ago(5) }, now), true);
  assert.equal(isPaymentInFlight({ status: "AWAITING_PAYMENT", createdAt: ago(119) }, now), true);
  assert.equal(isPaymentInFlight({ status: "AWAITING_PAYMENT", createdAt: ago(121) }, now), false);
  for (const s of ["PAYMENT_FAILED", "CANCELLED", "PENDING", "PENDING_NEW", "DELIVERED"]) assert.equal(isPaymentInFlight({ status: s, createdAt: ago(5) }, now), false, s);
});

// ---- Bulgu 6: ödeme sonrası yan etkiler en iyi çaba; Kargonomi çağrıları zaman aşımlı ----
import { readFileSync } from "node:fs";
import { finalizePaidOrder } from "../lib/order-finalize.ts";

test("bulgu 6: gönderi/e-posta adımı hata verse de sipariş işlenmiş sayılır (callback 500 dönmez), hata loglanır", async () => {
  const logs = [];
  const calls = [];
  const done = await finalizePaidOrder({
    claim: async () => { calls.push("claim"); return true; },
    deductStock: async () => { calls.push("stock"); },
    announce: async () => { calls.push("announce"); throw new Error("Resend yanıt vermedi"); },
    log: (...a) => logs.push(a.join(" ")),
  });
  assert.equal(done, true);
  assert.deepEqual(calls, ["claim", "stock", "announce"]);
  assert.ok(logs[0].includes("Resend yanıt vermedi"));
});

test("bulgu 6: sahiplenme kaybedilirse stok ve bildirim adımı hiç çalışmaz", async () => {
  const calls = [];
  assert.equal(await finalizePaidOrder({ claim: async () => false, deductStock: async () => calls.push("stock"), announce: async () => calls.push("announce") }), false);
  assert.deepEqual(calls, []);
});

test("A7: stok düşümü hata verirse loglanır ve bildirim/e-posta/gönderi yine çalışır; sonuç true", async () => {
  const calls = [];
  const logs = [];
  const done = await finalizePaidOrder({
    claim: async () => true,
    deductStock: async () => { calls.push("stock"); throw new Error("stok tx"); },
    announce: async () => { calls.push("announce"); },
    log: (...a) => logs.push(a.join(" ")),
  });
  assert.equal(done, true);
  assert.deepEqual(calls, ["stock", "announce"]);
  assert.ok(logs.some((l) => l.includes("stok tx")));
});

test("bulgu 6: Kargonomi istekleri AbortSignal.timeout ile sınırlı ve tek fetch noktasından geçer", () => {
  const src = readFileSync(new URL("../lib/kargonomi.ts", import.meta.url), "utf8");
  assert.match(src, /signal:\s*init\.signal\s*\?\?\s*AbortSignal\.timeout\(KARGONOMI_TIMEOUT_MS\)/);
  assert.equal(src.match(/\bfetch\(/g).length, 1, "zaman aşımsız ikinci bir fetch eklenmemeli");
});
