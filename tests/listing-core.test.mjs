import test from "node:test";
import assert from "node:assert/strict";
import { applyListing, parseListingParams, stateToParams, colorKey, colorName, isDefaultState, colorSwatch } from "../lib/listing-core.ts";

const CATS = [
  { key: "kristal", slug: "kristal", title: "Kristal Serisi" },
  { key: "modern", slug: "modern", title: "Modern Avizeler" },
  { key: "yemek masasi", slug: "yemek-masasi", title: "Yemek Masası" },
];
const col = (...names) => names.map((n) => ({ k: colorKey(n), n: colorName(n) }));
// Varsayılan sıra = dizi sırası
const ROWS = [
  { id: "p1", cat: "kristal", price: 500, created: 10, updated: 90, featured: false, colors: col("Gold", "Bej (0146)") },
  { id: "p2", cat: "modern", price: 300, created: 30, updated: 80, featured: true, colors: col("Bej") },
  { id: "p3", cat: "modern", price: 300, created: 20, updated: 70, featured: false, colors: col("Siyah") },
  { id: "p4", cat: "kristal", price: 900, created: 40, updated: 60, featured: true, colors: col("Gold") },
  { id: "p5", cat: "yemek masasi", price: 100, created: 5, updated: 50, featured: false, colors: [] },
];
const run = (q = {}, rankIds) => applyListing(ROWS, parseListingParams(q), { cats: CATS, rankIds });

test("renk: yinelenen adlar birleşir (Bej = Bej (0146)), yer tutucular atılır", () => {
  assert.equal(colorKey("Bej (0146)"), "bej");
  assert.equal(colorKey("  BEJ "), "bej");
  assert.equal(colorKey("Gold (Mat)"), "gold-mat"); // harfli parantez korunur
  assert.equal(colorKey("Standart"), null);
  assert.equal(colorKey(""), null);
  assert.equal(colorSwatch("mat-siyah"), "#1c1917");
  assert.equal(colorSwatch("zzz"), null);
});

test("varsayılan: sıra korunur, filtre yok", () => {
  const r = run();
  assert.deepEqual(r.ids, ["p1", "p2", "p3", "p4", "p5"]);
  assert.equal(r.total, 5);
  assert.ok(isDefaultState(r.state));
});

test("fiyat sıralaması monoton, eşitlikte id, tekrar yok", () => {
  const a = run({ siralama: "fiyat-artan" }).ids;
  assert.deepEqual(a, ["p5", "p2", "p3", "p1", "p4"]);
  const d = run({ siralama: "fiyat-azalan" }).ids;
  assert.deepEqual(d, ["p4", "p1", "p2", "p3", "p5"]);
  assert.equal(new Set(a).size, a.length);
});

test("çok satan: sıralılar önde, kalanlar varsayılan sırada; yoksa varsayılana düşer", () => {
  assert.deepEqual(run({ siralama: "cok-satan" }, ["p4", "p2"]).ids, ["p4", "p2", "p1", "p3", "p5"]);
  assert.deepEqual(run({ siralama: "cok-satan" }, []).ids, ["p1", "p2", "p3", "p4", "p5"]);
});

test("öne çıkan: işaretliler önde, kararlı; en yeni: created azalan", () => {
  assert.deepEqual(run({ siralama: "one-cikan" }).ids, ["p2", "p4", "p1", "p3", "p5"]);
  assert.deepEqual(run({ siralama: "en-yeni" }).ids, ["p4", "p2", "p3", "p1", "p5"]);
});

test("kategori + renk + fiyat filtreleri", () => {
  assert.deepEqual(run({ kategori: "modern" }).ids, ["p2", "p3"]);
  assert.deepEqual(run({ kategori: "modern,kristal" }).ids, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(run({ kategori: ["modern", "kristal"] }).ids, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(run({ renk: "bej" }).ids, ["p1", "p2"]);
  assert.deepEqual(run({ fiyat_min: "300", fiyat_max: "500" }).ids, ["p1", "p2", "p3"]);
  assert.deepEqual(run({ renk: "gold", kategori: "kristal", fiyat_min: "600" }).ids, ["p4"]);
});

test("facet sayıları: grup kendisi hariç diğer filtrelere göre", () => {
  const r = run({ kategori: "modern" });
  // kategori sayıları kategori filtresinden etkilenmez
  assert.deepEqual(r.facets.categories.map((c) => [c.slug, c.count, c.selected]), [["kristal", 2, false], ["modern", 2, true], ["yemek-masasi", 1, false]]);
  // renk sayıları kategori=modern içinde
  assert.deepEqual(r.facets.colors.map((c) => [c.key, c.count]), [["bej", 1], ["siyah", 1]]);
  assert.deepEqual(r.facets.price, { min: 300, max: 300 });
  const g = run({ renk: "gold" });
  assert.deepEqual(g.facets.colors.map((c) => [c.key, c.count]), [["bej", 2], ["gold", 2], ["siyah", 1]]); // renk sayıları kendi filtresinden bağımsız
  assert.deepEqual(g.facets.categories.map((c) => [c.slug, c.count]), [["kristal", 2]]);
  assert.equal(g.total, 2);
});

test("geçersiz/bilinmeyen parametreler sessizce varsayılana düşer", () => {
  const r = run({ siralama: "<script>", kategori: "yok,../x,<b>", renk: "kirmizi", fiyat_min: "abc", fiyat_max: "-5" });
  assert.deepEqual(r.state, { siralama: "onerilen", kategoriler: [], renkler: [] });
  assert.equal(r.total, 5);
  const big = parseListingParams({ kategori: Array.from({ length: 100 }, (_, i) => "k" + i).join(",") });
  assert.ok(big.kategoriler.length <= 12);
  assert.equal(parseListingParams({ fiyat_min: "500", fiyat_max: "100" }).fiyatMin, 100); // ters aralık yer değiştirir
});

test("boş sonuç ve URL durumu", () => {
  const r = run({ fiyat_min: "5000" });
  assert.equal(r.total, 0);
  assert.deepEqual(r.facets.price, { min: 100, max: 900 }); // aralık kendi filtresinden bağımsız
  assert.equal(run({ kategori: "modern", renk: "gold" }).facets.price, null);
  const s = parseListingParams({ siralama: "fiyat-artan", kategori: "modern", renk: "bej", fiyat_min: "100,5", fiyat_max: "900" });
  assert.deepEqual(stateToParams(s), { siralama: "fiyat-artan", kategori: "modern", renk: "bej", fiyat_min: "100.5", fiyat_max: "900" });
  assert.deepEqual(stateToParams(parseListingParams({})), {});
});
