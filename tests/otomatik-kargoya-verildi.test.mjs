import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { register } from "node:module";

register("./_hooks-otomatik-kargo.mjs", import.meta.url);

const { markShippedAuto, refreshWithAutoShip, isStartedTransition, KARGONOMI_STARTED } = await import("../lib/mark-shipped.ts");
const webhook = await import("../app/api/kargonomi/webhook/route.ts");

// Bellek içi sipariş deposu: updateMany koşulları gerçek sorgudaki gibi (eşitlik, not, OR) değerlendirilir
function makeDb(order) {
  const o = { id: "o1", userId: "u1", status: "PENDING", shippingType: "STANDART_KARGO", kargonomiShipmentId: 7, kargonomiStatus: "ready", kargonomiStatusLabel: null, shippingTrackingCode: null, shippingBarcode: "BRK-1", shippingProviderName: "Aras Kargo", ...order };
  const ok = (w) =>
    Object.entries(w).every(([k, v]) => {
      if (k === "OR") return v.some(ok);
      if (v && typeof v === "object" && "not" in v) return o[k] !== v.not && !(v.not === null && o[k] === null);
      return o[k] === v;
    });
  globalThis.__fakePrisma = {
    order: {
      findUnique: async () => ({ ...o }),
      updateMany: async ({ where, data }) => {
        await Promise.resolve(); // eşzamanlı çağrıların sıralı görünmemesi için bir tur ver
        if (!ok(where)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
      findFirst: async () => ({ id: o.id }),
    },
    user: { findUnique: async () => ({ email: "musteri@example.invalid", name: "Müşteri" }) },
  };
  return o;
}
function makeDeps(o, refreshResult) {
  const calls = { notify: [], email: [], refresh: 0 };
  return {
    calls,
    deps: {
      notify: async (t, p) => void calls.notify.push(p),
      email: async (d) => void calls.email.push(d),
      refresh: async () => {
        calls.refresh++;
        Object.assign(o, refreshResult ?? {});
        return { ...o };
      },
    },
  };
}
const ON = () => (process.env.AUTO_SHIP_ENABLED = "1");
const OFF = () => delete process.env.AUTO_SHIP_ENABLED;

test("geçiş kuralı: yalnız started'a geçişte", () => {
  assert.equal(isStartedTransition("ready", KARGONOMI_STARTED), true);
  assert.equal(isStartedTransition(null, KARGONOMI_STARTED), true);
  assert.equal(isStartedTransition(KARGONOMI_STARTED, KARGONOMI_STARTED), false);
  assert.equal(isStartedTransition("ready", "cancelled"), false);
});

test("started'a geçiş bir kez tetiklenir; ikinci yenileme (aynı olay) ikinci e-posta atmaz", async () => {
  ON();
  const o = makeDb({});
  const { deps, calls } = makeDeps(o, { kargonomiStatus: KARGONOMI_STARTED, shippingTrackingCode: "TK-1" });
  const r1 = await refreshWithAutoShip("o1", deps);
  assert.equal(r1.autoShipped, true);
  assert.equal(o.status, "SHIPPED");
  const r2 = await refreshWithAutoShip("o1", deps);
  assert.equal(r2.autoShipped, false);
  assert.equal(calls.email.length, 1);
  assert.equal(calls.notify.length, 1);
  assert.match(calls.notify[0].title, /otomatik/);
  assert.equal(calls.email[0].trackingKind, "code");
  OFF();
});

test("Geri Al sonrası: durum PENDING, kayıtlı durum started → tekrar geçiş olmaz", async () => {
  ON();
  const o = makeDb({});
  const { deps, calls } = makeDeps(o, { kargonomiStatus: KARGONOMI_STARTED, shippingTrackingCode: "TK-1" });
  await refreshWithAutoShip("o1", deps);
  o.status = "PENDING"; // yönetici Geri Al yaptı
  const r = await refreshWithAutoShip("o1", deps);
  assert.equal(r.autoShipped, false);
  assert.equal(o.status, "PENDING");
  assert.equal(calls.email.length, 1);
  OFF();
});

test("bayrak kapalıyken geçiş yok (durum yine kaydedilir)", async () => {
  OFF();
  const o = makeDb({});
  const { deps, calls } = makeDeps(o, { kargonomiStatus: KARGONOMI_STARTED });
  const r = await refreshWithAutoShip("o1", deps);
  assert.equal(r.autoShipped, false);
  assert.equal(o.status, "PENDING");
  assert.equal(o.kargonomiStatus, KARGONOMI_STARTED);
  assert.equal(calls.email.length, 0);
});

test("mağazadan teslim, iptal, teslim edilmiş, kargolanmış ve gönderisiz sipariş etkilenmez", async () => {
  ON();
  for (const over of [{ shippingType: "BEYOGLU_MAGAZA_TESLIM" }, { status: "CANCELLED" }, { status: "DELIVERED" }, { status: "SHIPPED" }, { kargonomiShipmentId: null }]) {
    const o = makeDb(over);
    const { deps, calls } = makeDeps(o, {});
    assert.equal(await markShippedAuto("o1", { refreshed: true }, deps), false, JSON.stringify(over));
    assert.equal(o.status, over.status ?? "PENDING");
    assert.equal(calls.email.length + calls.notify.length, 0);
  }
  OFF();
});

test("iki eşzamanlı çağrıdan yalnız biri e-posta atar", async () => {
  ON();
  const o = makeDb({ shippingTrackingCode: "TK-9" });
  const { deps, calls } = makeDeps(o, {});
  const res = await Promise.all([markShippedAuto("o1", { refreshed: true }, deps), markShippedAuto("o1", { refreshed: true }, deps)]);
  assert.deepEqual(res.slice().sort(), [false, true]);
  assert.equal(calls.email.length, 1);
  OFF();
});

test("takip kodu yokken e-posta 'Gönderi barkodu' etiketiyle gider; kod yoksa bir kez yenilenir", async () => {
  ON();
  const o = makeDb({ shippingTrackingCode: null, shippingBarcode: "BRK-1" });
  const { deps, calls } = makeDeps(o, {});
  assert.equal(await markShippedAuto("o1", { refreshed: false }, deps), true);
  assert.equal(calls.refresh, 1);
  assert.equal(calls.email[0].trackingKind, "barcode");
  assert.equal(calls.email[0].trackingNumber, "BRK-1");
  assert.match(calls.notify[0].message, /Gönderi barkodu: BRK-1/);
  OFF();
});

// ---- webhook ----
const SECRET = "test-secret";
const sign = (raw) => createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
const body = (status) => JSON.stringify({ event: "shipment.updated", data: { shipment: { id: 7, status } } });
const post = (raw, sig) => webhook.POST(new Request("http://x/api/kargonomi/webhook", { method: "POST", body: raw, headers: { "x-webhook-signature": sig } }));

test("webhook: imza bozuksa 401 ve hiçbir işlem yok", async () => {
  ON();
  process.env.KARGONOMI_WEBHOOK_SECRET = SECRET;
  const o = makeDb({});
  const raw = body(KARGONOMI_STARTED);
  const res = await post(raw, "bozuk");
  assert.equal(res.status, 401);
  assert.equal(o.status, "PENDING");
  assert.equal(o.kargonomiStatus, "ready");
  OFF();
});

test("webhook: started olayı bir kez kargoya verir; tekrar gelen olay ve Geri Al sonrası tetiklemez", async () => {
  ON();
  process.env.KARGONOMI_WEBHOOK_SECRET = SECRET;
  const o = makeDb({ shippingTrackingCode: "TK-5" });
  const calls = { n: 0 };
  // markShippedAuto varsayılan bağımlılıkları gerçek bildirim/e-posta; sahte veritabanında notification yok → güvenli olması için bildirim tablosunu sahte ver
  globalThis.__fakePrisma.notification = { create: async () => void calls.n++ };
  process.env.RESEND_API_KEY = "";
  const raw = body(KARGONOMI_STARTED);
  assert.equal((await post(raw, sign(raw))).status, 200);
  assert.equal(o.status, "SHIPPED");
  assert.equal(o.kargonomiStatus, KARGONOMI_STARTED);
  assert.equal(calls.n, 1);
  await post(raw, sign(raw)); // aynı olay tekrar
  assert.equal(calls.n, 1);
  o.status = "PENDING"; // Geri Al
  await post(raw, sign(raw));
  assert.equal(o.status, "PENDING");
  assert.equal(calls.n, 1);
  OFF();
});

test("webhook: bayrak kapalıyken started olayı yok sayılır", async () => {
  OFF();
  process.env.KARGONOMI_WEBHOOK_SECRET = SECRET;
  const o = makeDb({});
  const raw = body(KARGONOMI_STARTED);
  await post(raw, sign(raw));
  assert.equal(o.status, "PENDING");
  assert.equal(o.kargonomiStatus, "ready");
});
