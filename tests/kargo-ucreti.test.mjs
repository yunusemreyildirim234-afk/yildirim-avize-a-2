import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { decideShippingPrice, shippingPriceToKurus } = await import("../lib/shipping-fee.ts");
const { monthlyRevenueFromRows, vatBreakdown, NO_CARRIER_LABEL } = await import("../lib/monthly-revenue.ts");
const { VAT_RATE, vatIncluded, excludingVat } = await import("../lib/vat.ts");

// Sahte yanıtlar: ad/adres/takip kodu yok
const ship = (status, pricing) => ({ id: 1, status, pricing });

test("started + real = estimated; real_price öncelikli", () => {
  assert.equal(decideShippingPrice(ship("webservice_shipment_started", { estimated_price: 195.4373, real_price: 195.4373, price_diff: 0, extra_shipping_price: "0.0000" })), "195.44");
  assert.equal(decideShippingPrice(ship("webservice_shipment_started", { estimated_price: 100, real_price: 120.5, extra_shipping_price: "0.0000" })), "120.50");
});

test("iptal edilmiş gönderi: null (real_price null olsa da)", () => {
  assert.equal(decideShippingPrice(ship("cancelled", { estimated_price: 132.948, real_price: null, extra_shipping_price: "0.0000" })), null);
});

test("real null ama iptal değil: tahmini ücret + yuvarlama", () => {
  assert.equal(decideShippingPrice(ship("ready", { estimated_price: 132.948, real_price: null, extra_shipping_price: "0.0000" })), "132.95");
});

test("eksik/beklenmedik yanıt: undefined (mevcut ücrete dokunulmaz)", () => {
  assert.equal(decideShippingPrice(ship("draft", undefined)), undefined);
  assert.equal(decideShippingPrice(ship("draft", {})), undefined);
  assert.equal(decideShippingPrice(ship("draft", { estimated_price: null, real_price: null })), undefined);
  assert.equal(decideShippingPrice(ship("draft", { estimated_price: "abc" })), undefined);
  assert.equal(decideShippingPrice(null), undefined);
  assert.equal(decideShippingPrice("x"), undefined);
});

test("extra_shipping_price: 0, 12.5, boş, bozuk", () => {
  const p = (extra) => ship("webservice_shipment_started", { estimated_price: 195.4373, real_price: 195.4373, extra_shipping_price: extra });
  assert.equal(decideShippingPrice(p("0.0000")), "195.44");
  assert.equal(decideShippingPrice(p("12.5000")), "207.94");
  assert.equal(decideShippingPrice(p("")), "195.44");
  assert.equal(decideShippingPrice(p(undefined)), "195.44");
  assert.equal(decideShippingPrice(p("bozuk")), "195.44");
  assert.equal(decideShippingPrice(p(null)), "195.44");
});

test("shippingPriceToKurus", () => {
  assert.equal(shippingPriceToKurus("195.44"), 19544);
  assert.equal(shippingPriceToKurus(null), null);
  assert.equal(shippingPriceToKurus(""), null);
  assert.equal(shippingPriceToKurus("x"), null);
});

test("KDV: oran, 120 ₺ → 20 / 100; 9745 ₺", () => {
  assert.equal(VAT_RATE, 0.2);
  assert.equal(vatIncluded(12000), 2000);
  assert.equal(excludingVat(12000), 10000);
  const v = vatBreakdown(974500, 19544);
  assert.equal(v.salesVat, 1624.17);
  assert.equal(v.revenueExVat, 8120.83);
  assert.equal(v.shippingVat, 32.57);
  assert.equal(v.afterShippingExVat, 7957.97); // (9745 − 195,44) / 1,2 = 7957,9667
  assert.deepEqual(vatBreakdown(0, 0), { salesVat: 0, shippingVat: 0, revenueExVat: 0, afterShippingExVat: 0 });
});

const NOW = new Date("2026-11-22T10:00:00Z");
test("aylık: kargo gideri, kargo düşülmüş ciro, firmaya göre gruplama, eksik kayıt", () => {
  const rows = [
    { key: "2026-11", carrier: "Aras Kargo", n: 3, kurus: 300000, shipKurus: 39088, shipN: 2, cargoN: 3 },
    { key: "2026-11", carrier: "", n: 1, kurus: 50000, shipKurus: 0, shipN: 0, cargoN: 0 }, // mağazadan teslim
    { key: "2026-11", carrier: "Hepsijet", n: 1, kurus: 100000, shipKurus: 15000, shipN: 1, cargoN: 1 },
    { key: "2026-10", carrier: "", n: 1, kurus: 80000, shipKurus: 9000, shipN: 1, cargoN: 1 },
  ];
  const r = monthlyRevenueFromRows(rows, NOW);
  const nov = r.months[0];
  assert.equal(nov.orderCount, 5);
  assert.equal(nov.revenue, 4500);
  assert.equal(nov.shipping, 540.88);
  assert.equal(nov.afterShipping, 3959.12);
  assert.equal(nov.shipRecorded, 3);
  assert.equal(nov.cargoOrders, 4); // mağazadan teslim eksik sayılmaz: 4 kargo siparişinden 3'ünde kayıt var
  assert.deepEqual(nov.carriers, [
    { name: "Aras Kargo", total: 390.88, count: 2 },
    { name: "Hepsijet", total: 150, count: 1 },
  ]);
  // firma adı boş ama ücret kayıtlı → "Belirtilmemiş"
  assert.deepEqual(r.months[1].carriers, [{ name: NO_CARRIER_LABEL, total: 90, count: 1 }]);
  assert.equal(r.totals.shipping, 630.88);
  assert.equal(r.totals.afterShipping, 4669.12);
  assert.equal(r.totals.revenue, 5300);
  assert.equal(r.current.key, "2026-11");
  assert.equal(r.currentRevenue, 4500);
});

test("eski biçimli satırlar (kargo alanı yok) ve boş veri bozulmaz", () => {
  const r = monthlyRevenueFromRows([{ key: "2026-11", n: 2, kurus: 1000 }], NOW);
  assert.equal(r.months[0].shipping, 0);
  assert.equal(r.months[0].afterShipping, 10);
  assert.equal(r.months[0].cargoOrders, 0);
  const e = monthlyRevenueFromRows([], NOW);
  assert.equal(e.current.revenue, 0);
  assert.deepEqual(e.current.carriers, []);
});

test("kaynak: yazma noktası refreshOrderShipment'ta, SQL tek sorgu; arayüzde yerel confirm/alert yok", () => {
  const k = readFileSync(new URL("../lib/kargonomi.ts", import.meta.url), "utf8");
  assert.match(k, /const fee = decideShippingPrice\(shipment\);/);
  assert.match(k, /fee !== undefined \? \{ shippingPrice: fee \} : \{\}/);
  const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.equal((page.match(/\$queryRaw/g) ?? []).length, 1);
  assert.match(page, /GROUP BY 1, 2/);
  const card = readFileSync(new URL("../components/AdminRevenueCard.tsx", import.meta.url), "utf8");
  assert.ok(!/\b(confirm|alert|prompt)\(/.test(card));
  assert.ok(!/Net ciro/i.test(card));
});
