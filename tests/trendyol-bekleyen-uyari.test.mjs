import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sumPendingByVariation, stockChangeVariationIds, pendingByBarcode, pendingWarning, OPEN_ORDER_STATUSES } from "../lib/trendyol-bekleyen.ts";
import { stockDecision } from "../lib/trendyol-plan.ts";

const it = (variationId, quantity, status, stockDeducted = true) => ({ variationId, quantity, order: { status, stockDeducted } });
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("yalnız stoğu düşülmüş ve açık durumdaki siparişler sayılır", () => {
  const r = sumPendingByVariation([
    it("v1", 2, "PENDING"), it("v1", 1, "PENDING_NEW"), it("v1", 3, "AWAITING_PAYMENT"), it("v1", 1, "READY_FOR_PICKUP"),
    it("v1", 9, "SHIPPED"), it("v1", 9, "DELIVERED"), it("v1", 9, "CANCELLED"), it("v1", 9, "PENDING", false),
    it("v2", 4, "PENDING"),
  ]);
  assert.deepEqual(r, { v1: 7, v2: 4 });
  assert.deepEqual([...OPEN_ORDER_STATUSES], ["AWAITING_PAYMENT", "PENDING_NEW", "PENDING", "READY_FOR_PICKUP"]);
});

test("barkod eşlemesi: yalnız stok değişikliği olan ve adedi > 0 olan varyasyon", () => {
  const vf = (alan) => ({ alan, grup: "STOCK", simdiki: 1, trendyol: 5, karar: "EZİLECEK", elleDegisti: false });
  const products = [{ variations: [
    { barcode: "B1", id: "v1", fields: [vf("stock")] },
    { barcode: "B2", id: "v2", fields: [vf("price")] },
    { barcode: "B3", id: "v3", fields: [vf("stock")] },
    { barcode: "B4", id: null, fields: [vf("stock")] },
  ] }];
  assert.deepEqual(stockChangeVariationIds(products).sort(), ["v1", "v3"]);
  assert.deepEqual(pendingByBarcode(products, { v1: 3, v2: 5 }), { B1: 3 });
  assert.match(pendingWarning(3), /Sitede bekleyen 3 adet sipariş var, Trendyol'da düşüldüğünden emin olun/);
});

test("stok formülü değişmedi (OVERWRITE: T - rezerve; KEEP: kayma)", () => {
  assert.equal(stockDecision("OVERWRITE", 5, 10, 10, 3).yeni, 7);
  assert.equal(stockDecision("OVERWRITE", 5, 10, 2, 9).yeni, 0);
  assert.equal(stockDecision("KEEP", 4, 10, 12, 0).yeni, 6);
});

test("kablolama: uç yalnız önizlemede sayar; arayüz uyarıyı satırda ve onay penceresinde gösterir", () => {
  const r = read("app/api/admin/trendyol/sync/route.ts");
  assert.match(r, /pendingByBarcode\(plan\.products/);
  assert.match(r, /plan: \{ \.\.\.onizleme\(plan\), bekleyen(, kalkanVaryasyonlar: plan\.kalkan)? \}/);
  const c = read("components/AdminTrendyolSync.tsx");
  assert.match(c, /pendingWarning\(pending\)/);
  assert.match(c, /sitede bekleyen sipariş var/);
});
