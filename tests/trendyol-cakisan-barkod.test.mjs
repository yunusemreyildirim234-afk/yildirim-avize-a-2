import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { cakisanBarkodlar, kalkanPlani } = await import("../lib/trendyol-kalkan.ts");
const { GROUPS } = await import("../lib/trendyol-plan.ts");

const g = (mainId, ...codes) => ({ mainId, title: `Ürün ${mainId}`, variations: codes.map((barcode) => ({ barcode })) });
const m = (mainId, ...codes) => ({ trendyolMainId: mainId, title: `Site ${mainId}`, variations: codes.map((barcode) => ({ barcode })) });

test("çakışma yoksa liste boş; boş barkod sayılmaz", () => {
  assert.deepEqual(cakisanBarkodlar([g("A", "1", "2"), g("B", "3", "")], []), []);
});

test("ürünler arası tekrar: iki ürün listelenir, sitede tutan ürün gösterilir", () => {
  const r = cakisanBarkodlar([g("A", "X"), g("B", "X", "Y")], [m("A", "X")]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].urunler.map((u) => [u.mainId, u.adet]), [["A", 1], ["B", 1]]);
  assert.deepEqual(r[0].sitede, { mainId: "A", baslik: "Site A" });
});

test("ürün içi tekrar: tek üründe adet 2; sitede yoksa null; boşluk yok sayılır; barkoda göre sıralı", () => {
  const r = cakisanBarkodlar([g("A", "Z", " Z", "K", "K ")], []);
  assert.deepEqual(r.map((c) => [c.barkod, c.urunler[0].adet, c.sitede]), [["K", 2, null], ["Z", 2, null]]);
});

test("kalkanPlani sonucu çakışanları taşır ve STOCK=SKIP iken de verir", () => {
  const ayar = Object.fromEntries(GROUPS.map((x) => [x, x === "STOCK" ? "SKIP" : "KEEP"]));
  const k = kalkanPlani([], [{ ...g("A", "X"), variations: [{ barcode: "X" }] }, g("B", "X")], new Set(), {}, ayar);
  assert.deepEqual(k.cakisanBarkodlar.map((c) => c.barkod), ["X"]);
});

const { kalkanSifirlaSecimi } = await import("../lib/trendyol-kalkan.ts");
const ayarK = Object.fromEntries(GROUPS.map((x) => [x, "KEEP"]));
const ev = (id, barcode, value, stock) => ({ id, barcode, variationValue: value, extraPrice: 0, stock, stockCode: null, salePrice: 100, listPrice: null, syncStock: stock, syncSnapshot: null });
const iv = (barcode, value) => ({ barcode, variationValue: value, extraPrice: 0, stock: 5, stockCode: null, salePrice: 100, listPrice: null });
const mevcutP = (id, main, variations) => ({ id, trendyolMainId: main, title: `Ürün ${main}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, syncSnapshot: null, variations });
const gelenP = (main, variations) => ({ mainId: main, title: `Ürün ${main}`, description: null, category: "Kristal", basePrice: 100, listPrice: null, images: [], active: true, brand: null, trendyolCategory: null, trendyolUrl: null, variations });

test("barkodu gelen listede başka üründe geçen kapalı renk: rozet + işaretlenemez (atlanır); öteki satır etkilenmez", () => {
  // A'da X (Altın) ve Y (Krom) var; Trendyol X'i B'ye taşıdı, Y'yi kapattı (hiçbir üründe yok)
  const k = kalkanPlani(
    [mevcutP("pa", "A", [ev("x", "X", "Altın", 4), ev("y", "Y", "Krom", 3), ev("z", "Z", "Siyah", 2)])],
    [gelenP("A", [iv("Z", "Siyah")]), gelenP("B", [iv("X", "Altın")])],
    new Set(["Y"]), {}, ayarK,
  );
  const v = Object.fromEntries(k.urunler[0].varyasyonlar.map((x) => [x.varyasyonId, x]));
  assert.equal(v.x.barkodBaskaUrunde, true);
  assert.ok(v.x.rozetler.includes("BARKOD BAŞKA ÜRÜNDE"));
  assert.equal(v.y.barkodBaskaUrunde, false);
  assert.ok(!v.y.rozetler.includes("BARKOD BAŞKA ÜRÜNDE"));
  const s = kalkanSifirlaSecimi(k, [{ varyasyonId: "x", stok: 4 }, { varyasyonId: "y", stok: 3 }]);
  assert.deepEqual(s.uygulanacak.map((r) => r.varyasyonId), ["y"]);
  assert.deepEqual(s.atlanan.map((r) => [r.varyasyonId, r.neden]), [["x", "BARKOD_BASKA_URUNDE"]]);
});
