import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { buildPlan } = await import("../lib/trendyol-sync.ts");
const { TrendyolGuardError } = await import("../lib/trendyol-guard.ts");
const { GROUPS, planSync } = await import("../lib/trendyol-plan.ts");

const AYAR = Object.fromEntries(GROUPS.map((g) => [g, "OVERWRITE"]));
const row = (n) => ({ id: `p${n}`, trendyolMainId: `M${n}`, title: `Ürün ${n}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations: [{ id: `v${n}`, barcode: `B${n}`, variationValue: "Standart", extraPrice: 0, stock: 5, stockCode: null, salePrice: 100, listPrice: 100, syncStock: 5, syncSnapshot: null }] });
const item = (n) => ({ barcode: `B${n}`, title: `Ürün ${n}`, productMainId: `M${n}`, quantity: 5, salePrice: 100, listPrice: 100, onSale: true, approved: true, archived: false, blacklisted: false, images: [], categoryName: "Avize" });

// Sahte Trendyol yanıtı ve sahte depo: ağ ve veritabanı yok. Her yazma çağrısı kaydedilir.
function kur(trendyolItems, rows) {
  const writes = [];
  process.env.TRENDYOL_SUPPLIER_ID = "test"; // sahte değerler; gerçek anahtar okunmaz
  process.env.TRENDYOL_TOKEN = "test";
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: trendyolItems, totalPages: 1 }) });
  const w = (n) => async () => { writes.push(n); };
  globalThis.__fakePrisma = {
    product: { findMany: async () => rows, update: w("product.update"), createMany: w("product.createMany") },
    productVariation: { update: w("variation.update"), createMany: w("variation.createMany") },
    orderItem: { groupBy: async () => [] },
    $transaction: w("$transaction"),
    $executeRaw: w("$executeRaw"),
  };
  return writes;
}

test("Trendyol boş liste döndürürse eşitleme durur; hiçbir ürün gizlenmez/yazılmaz", async () => {
  const writes = kur([], [row(1), row(2), row(3)]);
  await assert.rejects(() => buildPlan(AYAR), (e) => e instanceof TrendyolGuardError && /boş geldi/.test(e.message));
  assert.deepEqual(writes, []);
});

test("yarım liste (eşleşmiş ürünlerin yarısından az) eşitlemeyi durdurur", async () => {
  const writes = kur([item(1)], [row(1), row(2), row(3), row(4)]);
  await assert.rejects(() => buildPlan(AYAR), (e) => e instanceof TrendyolGuardError && /eksik görünüyor/.test(e.message));
  assert.deepEqual(writes, []);
});

test("tam liste plan üretir ve hiçbir şey yazmaz (önizleme yalnız okur)", async () => {
  const writes = kur([item(1), item(2)], [row(1), row(2)]);
  const plan = await buildPlan(AYAR);
  assert.equal(plan.products.length, 2);
  assert.equal(plan.sayac.pasifeAlinacak, 0);
  assert.deepEqual(writes, []);
});

test("koruma olmasaydı: eksik liste, eksik kalan ürünleri 'kalkan' sayıp pasife alırdı (korumanın nedeni)", () => {
  const rows = [row(1), row(2), row(3), row(4)];
  const plan = planSync(rows, [], AYAR, {});
  assert.equal(plan.sayac.pasifeAlinacak, 4);
  assert.ok(plan.products.every((p) => p.kalkan));
});
