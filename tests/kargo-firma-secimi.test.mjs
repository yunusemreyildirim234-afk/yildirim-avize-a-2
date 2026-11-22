import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { parseQuotes, selectableQuotes, recommendProvider, resolveProvider, isSelectableProviderId } = await import("../lib/carrier-quotes.ts");
const { openShipmentWithProvider } = await import("../lib/shipping-confirm.ts");
const { buildShippedNotice } = await import("../lib/shipped-notice.ts");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PRICES = { shipping_provider_with_price: [
  { id: 4, name: "Aras Kargo", slug: "aras", price: "22.67 + KDV" },
  { id: 6, name: "Hepsijet", slug: "hepsijet", price: "Hizmet Dışı Bölge" },
  { id: 5, name: "Sürat", slug: "surat", price: "30 + KDV" },
] };

test("teklif ayrıştırma: normal, Hizmet Dışı Bölge, yalnız Aras/Hepsijet seçilir", () => {
  const q = selectableQuotes(parseQuotes(PRICES));
  assert.deepEqual(q.map((x) => [x.providerId, x.available, x.priceText]), [[4, true, "22.67 + KDV"], [6, false, "Hizmet Dışı Bölge"]]);
});
test("teklif ayrıştırma: nesne biçimi ve bilinmeyen alan adı", () => {
  const q = parseQuotes({ data: { shipping_provider_with_price: { a: { id: 6, slug: "hepsijet", tutar: "40 TL + KDV" } } } });
  assert.equal(q[0].providerId, 6);
  assert.equal(q[0].available, true);
});
test("teklif ayrıştırma: bilinmeyen şekil → ikisi de kullanılamaz, çökmez", () => {
  for (const bad of [null, {}, { shipping_provider_with_price: "x" }, { shipping_provider_with_price: [1, null] }]) {
    const q = selectableQuotes(parseQuotes(bad));
    assert.equal(q.length, 2);
    assert.ok(q.every((x) => !x.available));
  }
});
test("öneri: 34 → Aras, diğer → Hepsijet, kullanılamaz → diğeri, ikisi yok → null", () => {
  const both = [{ providerId: 4, available: true }, { providerId: 6, available: true }];
  assert.equal(recommendProvider(34, both).providerId, 4);
  assert.equal(recommendProvider(null, both).providerId, 4);
  assert.equal(recommendProvider(6, both).providerId, 6);
  assert.equal(recommendProvider(34, [{ providerId: 4, available: false }, { providerId: 6, available: true }]).providerId, 6);
  assert.equal(recommendProvider(6, [{ providerId: 4, available: true }, { providerId: 6, available: false }]).providerId, 4);
  assert.equal(recommendProvider(6, [{ providerId: 4, available: false }, { providerId: 6, available: false }]), null);
});
test("firma eşleme ve providerId doğrulama", () => {
  assert.equal(resolveProvider({ slug: "aras" }).id, 4);
  assert.equal(resolveProvider({ name: "Hepsijet" }).id, 6);
  assert.equal(resolveProvider({ slug: "surat" }).id, 5);
  assert.equal(resolveProvider({ slug: "ptt" }).id, 7);
  assert.equal(resolveProvider({ slug: "kolaygelsin" }).id, 3);
  assert.equal(resolveProvider({ slug: "x" }), null);
  assert.equal(isSelectableProviderId(4), true);
  assert.equal(isSelectableProviderId(6), true);
  for (const v of [-1, 5, 7, "4", null, undefined]) assert.equal(isSelectableProviderId(v), false);
});

function deps(over = {}) {
  const calls = { confirm: [], refresh: 0, draft: 0 };
  let status = over.status ?? "draft";
  const mk = () => ({ kargonomiShipmentId: 9, kargonomiStatus: status, shippingProviderId: null, shippingProviderName: null, barcodeUrl: null, shippingTrackingCode: null, shippingBarcode: null });
  return {
    calls,
    d: {
      createDraft: async () => { calls.draft++; return mk(); },
      refresh: async () => { calls.refresh++; const s = mk(); if (calls.confirm.length) s.kargonomiStatus = "ready"; return s; },
      getPriceComparison: async () => over.prices ?? PRICES,
      confirmShippingPrice: async (id, p) => { calls.confirm.push([id, p]); },
    },
  };
}

test("taslak: kullanılabilir firma confirm edilir (shipment_id, provider_id), sonra yenilenir", async () => {
  const { calls, d } = deps();
  const r = await openShipmentWithProvider({ hasShipment: true, regenerate: false, providerId: 4 }, d);
  assert.deepEqual(calls.confirm, [[9, 4]]);
  assert.equal(r.confirmed, 4);
  assert.equal(calls.refresh, 2);
});
test("kullanılamaz firma 409; confirm yok", async () => {
  const { calls, d } = deps();
  await assert.rejects(openShipmentWithProvider({ hasShipment: true, regenerate: false, providerId: 6 }, d), (e) => e.status === 409);
  assert.equal(calls.confirm.length, 0);
});
test("taslak değilse (panelde onaylı) ikinci confirm yok; yalnız yenileme", async () => {
  const { calls, d } = deps({ status: "ready" });
  const r = await openShipmentWithProvider({ hasShipment: true, regenerate: false, providerId: 4 }, d);
  assert.equal(calls.confirm.length, 0);
  assert.equal(r.confirmed, null);
  assert.equal(calls.refresh, 1);
});
test("gönderi yoksa taslak açılır ve onaylanır", async () => {
  const { calls, d } = deps();
  await openShipmentWithProvider({ hasShipment: false, regenerate: false, providerId: 4 }, d);
  assert.equal(calls.draft, 1);
  assert.equal(calls.confirm.length, 1);
});

test("create-shipping rotası: providerId 4/6 dışı 400, durum yazılmaz, bildirim/e-posta yok", () => {
  const r = read("app/api/admin/orders/[id]/create-shipping/route.ts");
  assert.match(r, /isSelectableProviderId\(providerId\)\) return NextResponse\.json\(\{ error: [^}]*\}, \{ status: 400 \}\)/);
  assert.doesNotMatch(r, /status: "SHIPPED"/);
  assert.doesNotMatch(r, /notifyCustomer|sendShippedEmail/);
  assert.doesNotMatch(r, /shippingProviderId: 4/);
  assert.match(r, /data: \{ labelCreated: true,/);
});
test("createShipmentForOrder taslakta firma yazmaz; refresh firmayı senkronlar", () => {
  const k = read("lib/kargonomi.ts");
  const create = k.slice(k.indexOf("export async function createShipmentForOrder"), k.indexOf("/** Gönderinin güncel durumunu"));
  assert.doesNotMatch(create, /shippingProviderId|shippingProviderName/);
  const refresh = k.slice(k.indexOf("export async function refreshOrderShipment"));
  assert.match(refresh, /shipping_provider_slug/);
  assert.match(refresh, /shippingProviderId: prov\.id/);
  assert.match(k, /form\.append\("shipment_id"[\s\S]*form\.append\("shipping_provider_id"/);
  assert.match(k, /\/confirm-shipping-price/);
  assert.match(k, /\/shipment-price-comparison\//);
});
test("order-status: kargoya verildi bildirimi takip kodu varken gider, yokken/mağaza teslimde gitmez", () => {
  const base = { shippingType: "STANDART_KARGO", shippingTrackingCode: "T1", shippingBarcode: null, shippingProviderName: "Hepsijet" };
  const n = buildShippedNotice(base);
  assert.equal(n.carrier, "Hepsijet");
  assert.equal(n.message("abcdefghij"), "#abcdefgh: Siparişiniz kargoya verildi. Kargo: Hepsijet • Takip No: T1");
  assert.equal(n.link, "/kargo-takip?code=T1");
  assert.equal(buildShippedNotice({ ...base, shippingTrackingCode: null }), null);
  assert.equal(buildShippedNotice({ ...base, shippingTrackingCode: null, shippingBarcode: "B" }).tracking, "B");
  assert.equal(buildShippedNotice({ ...base, shippingType: "BEYOGLU_MAGAZA_TESLIM" }), null);
  const r = read("app/api/admin/order-status/route.ts");
  assert.match(r, /before\.status !== status && status === "SHIPPED" \? \(forcedShipped \? buildShippedNoticeForced\(updatedOrder\) : buildShippedNotice/);
  assert.match(r, /catch \(e\) \{\s*console\.warn\("Kargo e-postası/);
});
