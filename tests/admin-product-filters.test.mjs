import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMPTY_FILTERS, adminFacets, applyAdminFilters, hasAdminFilters, sortProducts } from "../lib/admin-product-filters.ts";
import { isOutOfStock } from "../lib/admin-product-quick-filters.ts";

const v = (value, stock, type = "Renk") => ({ variationType: type, variationValue: value, stock });
const P = [
  { id: "a", title: "Zeytin Avize", basePrice: 1000, variations: [v("Bej / 45 x 25", 3), v("Siyah / 45 x 25", 0)] },
  { id: "b", title: "Çınar Avize", basePrice: 500, variations: [v("Bej / 50 x 50", 0)] },
  { id: "c", title: "Akasya Avize", basePrice: 2500, ebat: "80 x 80", variations: [v("Siyah", 7), v("Gold", 2)] },
  { id: "d", title: "Defne Avize", basePrice: 750, variations: [] },
];
const sets = { featured: new Set(["c"]), bestseller: new Set(["b", "d"]) };
const f = (o) => ({ ...EMPTY_FILTERS, ...o });
const ids = (l) => l.map((p) => p.id);

test("varsayılan: süzgeçsiz, sıra korunur", () => {
  assert.deepEqual(ids(applyAdminFilters(P, EMPTY_FILTERS, sets)), ["a", "b", "c", "d"]);
  assert.equal(hasAdminFilters(EMPTY_FILTERS), false);
});

test("stok durumu: stokta / stoksuz mevcut isOutOfStock kuralıyla", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ stok: "stokta" }), sets)), ["a", "c"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ stok: "stoksuz" }), sets)), ["b", "d"]);
  assert.deepEqual(ids(P.filter(isOutOfStock)), ["b", "d"]);
});

test("renk süzgeci (çoklu) ve ebat süzgeci (varyasyon + ürün ebatı)", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["bej"] }), sets)), ["a", "b"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["bej", "gold"] }), sets)), ["a", "b", "c"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ ebatlar: ["45x25"] }), sets)), ["a"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ ebatlar: ["80x80"] }), sets)), ["c"]);
});

test("renk + ebat birlikte: aynı varyasyonda eşleşmeli", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["bej"], ebatlar: ["50x50"] }), sets)), ["b"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["siyah"], ebatlar: ["50x50"] }), sets)), []);
});

test("fiyat aralığı (min–max, uçlar dahil)", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ fiyatMin: 750, fiyatMax: 1000 }), sets)), ["a", "d"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ fiyatMin: 2000 }), sets)), ["c"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ fiyatMax: 500 }), sets)), ["b"]);
});

test("süzgeçler kesişir", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["bej"], stok: "stokta", fiyatMin: 900 }), sets)), ["a"]);
  assert.deepEqual(ids(applyAdminFilters(P, f({ renkler: ["bej"], stok: "stoksuz" }), sets)), ["b"]);
});

test("sıralamalar", () => {
  const s = (sort) => ids(sortProducts(P, sort, sets));
  assert.deepEqual(s("fiyat-artan"), ["b", "d", "a", "c"]);
  assert.deepEqual(s("fiyat-azalan"), ["c", "a", "d", "b"]);
  assert.deepEqual(s("ebat-artan"), ["a", "b", "c", "d"]); // 45x25 < 50x50 < 80x80, ebatsız sonda
  assert.deepEqual(s("ebat-azalan"), ["c", "b", "a", "d"]);
  assert.deepEqual(s("cok-satan"), ["b", "d", "a", "c"]);
  assert.deepEqual(s("one-cikan"), ["c", "a", "b", "d"]);
  assert.deepEqual(s("stok-artan"), ["b", "d", "a", "c"]);
  assert.deepEqual(s("stok-azalan"), ["c", "a", "b", "d"]);
  assert.deepEqual(s("ad-az"), ["c", "d", "a", "b"].sort((x, y) => P.find((p) => p.id === x).title.localeCompare(P.find((p) => p.id === y).title, "tr")));
  assert.deepEqual(s("en-yeni"), ["a", "b", "c", "d"]);
});

test("süzgeç + sıra birlikte", () => {
  assert.deepEqual(ids(applyAdminFilters(P, f({ stok: "stokta", siralama: "fiyat-azalan" }), sets)), ["c", "a"]);
});

test("facet sayıları: kendi grubu hariç, ürün başına bir kez", () => {
  const { colors, sizes } = adminFacets(P, EMPTY_FILTERS);
  assert.equal(colors.find((c) => c.key === "bej").count, 2);
  assert.equal(colors.find((c) => c.key === "siyah").count, 2);
  assert.equal(sizes.find((z) => z.key === "45x25").count, 1);
  const withColor = adminFacets(P, f({ renkler: ["gold"] }));
  assert.equal(withColor.colors.find((c) => c.key === "bej").count, 2); // kendi grubu süzgeçlenmez
  assert.equal(withColor.sizes.find((z) => z.key === "80x80").count, 1);
  assert.equal(withColor.sizes.find((z) => z.key === "45x25"), undefined);
});

test("AdminProductList: süzgeç paneli bağlı, mevcut Stoksuz çipi duruyor, shown başa döner", () => {
  const s = readFileSync(new URL("../components/AdminProductList.tsx", import.meta.url), "utf8");
  assert.match(s, /applyAdminFilters\(searched/);
  assert.match(s, /AdminProductFilterPanel/);
  assert.match(s, /QUICK_FILTER_LABELS/);
  assert.match(s, /setAdv\(next\); setShown\(PAGE\)/);
  const panel = readFileSync(new URL("../components/AdminProductFilterPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /aria-expanded=\{open\}/);
  assert.match(panel, /Filtrele ve Sırala/);
  assert.match(panel, /Süzgeçleri temizle/);
});

test("süzgeç sadeleştirme: çip sıraları oklu şeritte, renk/ebat açılır başlık, iç kaydırma yok", () => {
  const list = readFileSync(new URL("../components/AdminProductList.tsx", import.meta.url), "utf8");
  assert.equal((list.match(/<ScrollChips>/g) ?? []).length, 2);
  assert.equal((list.match(/<\/ScrollChips>/g) ?? []).length, 2);
  const strip = readFileSync(new URL("../components/ScrollChips.tsx", import.meta.url), "utf8");
  assert.match(strip, /aria-label="Sola kaydır"/);
  assert.match(strip, /aria-label="Sağa kaydır"/);
  assert.match(strip, /scrollBy/);
  const panel = readFileSync(new URL("../components/AdminProductFilterPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /aria-expanded=\{open\}\r?\n\s+aria-controls=\{listId\}/);
  assert.match(panel, /useState\(false\)/);
  assert.doesNotMatch(panel, /max-h-36|overflow-y-auto/);
});
