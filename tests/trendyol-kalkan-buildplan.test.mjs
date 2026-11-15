import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { buildPlan } = await import("../lib/trendyol-sync.ts");
const { GROUPS } = await import("../lib/trendyol-plan.ts");

const AYAR = Object.fromEntries(GROUPS.map((g) => [g, "KEEP"]));
const ev = (n, stock) => ({ id: `v${n}`, barcode: `B${n}`, variationValue: `R${n}`, extraPrice: 0, stock, stockCode: null, salePrice: 100, listPrice: 100, syncStock: stock, syncSnapshot: null });
const row = { id: "p1", trendyolMainId: "M1", title: "Ürün", description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations: [ev(1, 5), ev(2, 4), ev(3, 3)] };
const item = (n, extra = {}) => ({ barcode: `B${n}`, title: "Ürün", productMainId: "M1", quantity: 5, salePrice: 100, listPrice: 100, onSale: true, approved: true, archived: false, blacklisted: false, images: [], categoryName: "Avize", attributes: [{ attributeName: "Renk", attributeValue: `R${n}` }], ...extra });

test("buildPlan: yanıtta kapalı barkod KESİN, yanıtta olmayan ZAYIF; hiçbir şey yazılmaz", async () => {
  const writes = [];
  process.env.TRENDYOL_SUPPLIER_ID = "test";
  process.env.TRENDYOL_TOKEN = "test";
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: [item(1), item(2, { onSale: false })], totalPages: 1 }) });
  const w = (n) => async () => { writes.push(n); };
  globalThis.__fakePrisma = { product: { findMany: async () => [row], update: w("p"), createMany: w("pc") }, productVariation: { update: w("v"), createMany: w("vc") }, orderItem: { groupBy: async () => [] }, $transaction: w("t"), $executeRaw: w("raw") };
  const plan = await buildPlan(AYAR);
  const v = Object.fromEntries(plan.kalkan.urunler[0].varyasyonlar.map((x) => [x.barkod, x.guven]));
  assert.deepEqual(v, { B2: "KESIN", B3: "ZAYIF" });
  assert.deepEqual(writes, []);
});
