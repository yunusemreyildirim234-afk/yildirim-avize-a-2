import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { applyPlan } = await import("../lib/trendyol-sync.ts");
const { planSync, GROUPS } = await import("../lib/trendyol-plan.ts");

console.error = () => {}; // beklenen grup hataları test çıktısını kirletmesin
const ayar = (over) => ({ ...Object.fromEntries(GROUPS.map((g) => [g, "SKIP"])), ...over });
const exist = (n) => ({ id: `p${n}`, trendyolMainId: `M${n}`, title: `Eski ${n}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations: [] });
const inc = (n, over = {}) => ({ mainId: `M${n}`, title: `Yeni ${n}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, variations: [], ...over });

function sahte({ transactionFail = () => false, createManyFail = () => false, rawFail = () => false } = {}) {
  const log = { updates: [], products: [], variations: [], raw: [] };
  globalThis.__fakePrisma = {
    product: {
      update: (a) => ({ tablo: "product", ...a }),
      createMany: async ({ data }) => { if (createManyFail("product", data)) throw new Error("sahte ekleme hatası"); log.products.push(...data); },
    },
    productVariation: {
      update: (a) => ({ tablo: "variation", ...a }),
      createMany: async ({ data }) => { if (createManyFail("variation", data)) throw new Error("sahte ekleme hatası"); log.variations.push(...data); },
    },
    $transaction: async (ops) => { if (transactionFail(ops)) throw new Error("sahte işlem hatası"); log.updates.push(...ops); },
    $executeRaw: async (strings) => { const q = strings.join("?"); const mod = q.includes("SELECT SUM") ? "OVERWRITE" : "KEEP"; if (rawFail(mod)) throw new Error("sahte stok hatası"); log.raw.push(mod); },
  };
  return log;
}

test("yarıda hata: 150 ürünlük güncellemede ilk 100'lük grup düşer, kalan 50 yazılır; istisna fırlamaz, hata sayılır", async () => {
  const mevcut = Array.from({ length: 150 }, (_, i) => exist(i));
  const gelen = Array.from({ length: 150 }, (_, i) => inc(i));
  const plan = planSync(mevcut, gelen, ayar({ TEXT: "OVERWRITE" }), {});
  let cagri = 0;
  const log = sahte({ transactionFail: () => ++cagri === 1 });
  const res = await applyPlan(plan);
  assert.equal(res.hata, 100);
  assert.equal(res.guncellenenUrun, 50);
  assert.equal(log.updates.length, 50);
});

test("yeni ürün eklenemezse varyasyonları eklenmez (yetim kayıt yok); hata ürün sayısı kadardır", async () => {
  const v = { barcode: "B1", variationValue: "Altın", extraPrice: 0, stock: 2, stockCode: null, salePrice: 100, listPrice: null };
  const plan = planSync([], [inc(1, { variations: [v] })], ayar({ TEXT: "OVERWRITE" }), {});
  assert.equal(plan.products[0].yeni, true);
  const log = sahte({ createManyFail: (tablo) => tablo === "product" });
  const res = await applyPlan(plan);
  assert.equal(res.yeniUrun, 0);
  assert.equal(res.hata, 1);
  assert.equal(log.variations.length, 0);
});

test("yeni ürün eklenirse varyasyonu ürün kimliğiyle birlikte eklenir", async () => {
  const v = { barcode: "B1", variationValue: "Altın", extraPrice: 0, stock: 2, stockCode: null, salePrice: 100, listPrice: null };
  const plan = planSync([], [inc(1, { variations: [v] })], ayar({ TEXT: "OVERWRITE" }), {});
  const log = sahte();
  const res = await applyPlan(plan);
  assert.equal(res.yeniUrun, 1);
  assert.equal(res.yeniVaryasyon, 1);
  assert.equal(res.hata, 0);
  assert.equal(log.variations[0].productId, log.products[0].id);
});

test("stok yazımı: KEEP grubu düşse de OVERWRITE grubu yazılır; hata yalnız düşen grup için sayılır", async () => {
  const stok = (mode) => ({ id: `v-${mode}`, write: { data: {}, snapshot: null, stock: { mode, t: 5, degisir: true } } });
  const plan = { sayac: {}, products: [{ mainId: "M1", id: "p1", yeni: false, kalkan: false, fields: [], degerYazar: true, write: null, create: null, variations: [stok("KEEP"), stok("OVERWRITE")] }] };
  const log = sahte({ rawFail: (m) => m === "KEEP" });
  const res = await applyPlan(plan);
  assert.equal(res.hata, 1);
  assert.equal(res.stokGuncellenen, 1);
  assert.deepEqual(log.raw, ["OVERWRITE"]);
});

test("seçili liste: seçilmeyen değer yazan ürün atlanır ve sayılır", async () => {
  const plan = planSync([exist(1), exist(2)], [inc(1), inc(2)], ayar({ TEXT: "OVERWRITE" }), {});
  const log = sahte();
  const res = await applyPlan(plan, ["M1"]);
  assert.equal(res.atlanan, 1);
  assert.equal(log.updates.length, 1);
  assert.equal(log.updates[0].where.id, "p1");
});

test("düşen gruptaki ürünler sonuçta kimlik/başlıkla listelenir (en çok 20)", async () => {
  const mevcut = Array.from({ length: 30 }, (_, i) => exist(i));
  const gelen = Array.from({ length: 30 }, (_, i) => inc(i));
  const plan = planSync(mevcut, gelen, ayar({ TEXT: "OVERWRITE" }), {});
  sahte({ transactionFail: () => true });
  const res = await applyPlan(plan);
  assert.equal(res.hata, 30);
  assert.equal(res.hataliUrunler.length, 20);
  assert.deepEqual(Object.keys(res.hataliUrunler[0]).sort(), ["baslik", "id"]);
  const temiz = await (async () => { sahte(); return applyPlan(plan); })();
  assert.deepEqual(temiz.hataliUrunler, []);
});
