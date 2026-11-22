import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { decideShippedTracking, TRACKING_PENDING_MESSAGE, BARCODE_PENDING_MESSAGE } = await import("../lib/shipped-tracking.ts");
const { buildShippedNotice, buildShippedNoticeForced } = await import("../lib/shipped-notice.ts");

const kargo = { status: "PENDING", shippingType: "STANDART_KARGO", shippingTrackingCode: null, shippingBarcode: "YA-ABC", kargonomiShipmentId: 77 };
const mk = (results) => {
  const calls = { refresh: 0, sleep: 0 };
  return {
    calls,
    deps: {
      refresh: async () => {
        const r = results[calls.refresh++];
        if (r instanceof Error) throw r;
        return r;
      },
      sleep: async () => {
        calls.sleep++;
      },
    },
  };
};
const noCode = { shippingTrackingCode: null, shippingBarcode: "YA-ABC" };

test("kod ilk denemede geliyor: geçer, tek yenileme", async () => {
  const { deps, calls } = mk([{ shippingTrackingCode: "T-1", shippingBarcode: "YA-ABC" }]);
  assert.deepEqual(await decideShippedTracking(kargo, "o1", false, deps), { action: "proceed", forced: false });
  assert.equal(calls.refresh, 1);
  assert.equal(calls.sleep, 0);
});

test("kod ikinci denemede geliyor: geçer, aralarında bekleme", async () => {
  const { deps, calls } = mk([noCode, { shippingTrackingCode: "T-2", shippingBarcode: "YA-ABC" }]);
  assert.deepEqual(await decideShippedTracking(kargo, "o1", false, deps), { action: "proceed", forced: false });
  assert.equal(calls.refresh, 2);
  assert.equal(calls.sleep, 1);
});

test("kod hiç gelmiyor: force yoksa TRACKING_PENDING kararı (en çok 2 deneme), barkod varsa takip mesajı", async () => {
  const { deps, calls } = mk([noCode, noCode, noCode]);
  const d = await decideShippedTracking(kargo, "o1", false, deps);
  assert.equal(d.action, "pending");
  assert.equal(d.barcodeMissing, false);
  assert.equal(d.message, TRACKING_PENDING_MESSAGE);
  assert.equal(calls.refresh, 2);
});

test("barkod da yoksa mesaj 'Barkod henüz oluşturulmadı'", async () => {
  const { deps } = mk([{ shippingTrackingCode: null, shippingBarcode: null }, { shippingTrackingCode: null, shippingBarcode: null }]);
  const d = await decideShippedTracking({ ...kargo, shippingBarcode: null }, "o1", false, deps);
  assert.equal(d.action, "pending");
  assert.equal(d.barcodeMissing, true);
  assert.equal(d.message, BARCODE_PENDING_MESSAGE);
  assert.match(d.message, /^Barkod henüz oluşturulmadı\./);
});

test("force ile geçer (forced: true)", async () => {
  const { deps } = mk([noCode, noCode]);
  assert.deepEqual(await decideShippedTracking(kargo, "o1", true, deps), { action: "proceed", forced: true });
});

test("yenileme hata fırlatıyor: çökmez; force yoksa pending, force ile geçer", async () => {
  const a = mk([new Error("ağ"), new Error("ağ")]);
  assert.equal((await decideShippedTracking(kargo, "o1", false, a.deps)).action, "pending");
  assert.equal(a.calls.refresh, 2);
  const b = mk([new Error("ağ"), new Error("ağ")]);
  assert.deepEqual(await decideShippedTracking(kargo, "o1", true, b.deps), { action: "proceed", forced: true });
});

test("zaten gerçek takip kodu varsa yenileme yapılmaz", async () => {
  const { deps, calls } = mk([]);
  assert.deepEqual(await decideShippedTracking({ ...kargo, shippingTrackingCode: "T-9" }, "o1", false, deps), { action: "proceed", forced: false });
  assert.equal(calls.refresh, 0);
});

test("mağazadan teslim ve zaten kargodaki sipariş etkilenmez (yenileme yok)", async () => {
  const { deps, calls } = mk([]);
  assert.deepEqual(await decideShippedTracking({ ...kargo, shippingType: "BEYOGLU_MAGAZA_TESLIM", kargonomiShipmentId: null }, "o1", false, deps), { action: "proceed", forced: false });
  assert.deepEqual(await decideShippedTracking({ ...kargo, status: "SHIPPED" }, "o1", false, deps), { action: "proceed", forced: false });
  assert.equal(calls.refresh, 0);
});

test("gönderi kimliği yoksa yenileme denenmez; force yoksa pending", async () => {
  const { deps, calls } = mk([]);
  assert.equal((await decideShippedTracking({ ...kargo, kargonomiShipmentId: null }, "o1", false, deps)).action, "pending");
  assert.equal(calls.refresh, 0);
});

test("bildirim/e-posta: kod yoksa 'Gönderi barkodu', kod varsa 'Takip No', zorla ve hiçbiri yoksa takip satırsız", () => {
  const base = { shippingType: "STANDART_KARGO", shippingTrackingCode: "T1", shippingBarcode: "B1", shippingProviderName: "Aras Kargo" };
  const code = buildShippedNotice(base);
  assert.match(code.message("abcdef12-0000"), /Takip No: T1/);
  const bc = buildShippedNotice({ ...base, shippingTrackingCode: null });
  assert.equal(bc.trackingKind, "barcode");
  assert.match(bc.message("abcdef12-0000"), /Gönderi barkodu: B1/);
  assert.doesNotMatch(bc.message("abcdef12-0000"), /Takip No/);
  assert.equal(buildShippedNotice({ ...base, shippingTrackingCode: null, shippingBarcode: null }), null);
  const none = buildShippedNoticeForced({ ...base, shippingTrackingCode: null, shippingBarcode: null });
  assert.equal(none.trackingKind, "none");
  assert.doesNotMatch(none.message("abcdef12-0000"), /Takip|barkodu/);
  assert.equal(buildShippedNoticeForced({ ...base, shippingType: "BEYOGLU_MAGAZA_TESLIM", shippingTrackingCode: null, shippingBarcode: null }), null);
});

test("kargoya verildi e-postası: zorla geçişte barkod etiketi, hiçbiri yoksa takip satırı yok", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const sent = [];
  globalThis.fetch = async (_u, init) => (sent.push(JSON.parse(init.body)), { ok: true, json: async () => ({}) });
  const { sendShippedEmail } = await import("../lib/email.ts");
  const m = { to: "musteri@example.com", name: "Test", orderId: "abcdef12-0000-0000-0000-000000000000", carrier: "Aras Kargo" };
  await sendShippedEmail({ ...m, trackingNumber: "YA-ABC", trackingKind: "barcode" });
  assert.match(sent.at(-1).subject, /Gönderi barkodu: YA-ABC/);
  assert.match(sent.at(-1).html, /Gönderi barkodu/);
  assert.doesNotMatch(sent.at(-1).html, /Takip No/);
  await sendShippedEmail({ ...m, trackingNumber: "", trackingKind: "none" });
  assert.doesNotMatch(sent.at(-1).subject, /barkodu|Takip/);
  assert.doesNotMatch(sent.at(-1).html, /Gönderi barkodu|Takip No/);
});

test("uç: SHIPPED için karar çağrılır, 409 TRACKING_PENDING; arayüz sayfa içi onay (yerel confirm/alert yeni kodda yok)", () => {
  const r = readFileSync(new URL("../app/api/admin/order-status/route.ts", import.meta.url), "utf8");
  assert.match(r, /decideShippedTracking\(/);
  assert.match(r, /code: "TRACKING_PENDING"/);
  assert.match(r, /export const maxDuration = 30/);
  const c = readFileSync(new URL("../components/OrderStatusSelector.tsx", import.meta.url), "utf8");
  assert.match(c, /data\.code === "TRACKING_PENDING"/);
  assert.match(c, /force: true/);
  assert.match(c, /role="alert"/);
});
