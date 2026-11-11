import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowFilter } from "../lib/listing-where.ts";
import { categoryWhere } from "../lib/categories.ts";
import { applyListing, parseListingParams } from "../lib/listing-core.ts";
import { matchesSearch, searchText } from "../lib/search-rank.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Katalog (veritabanı sırası: updatedAt azalan). db: Prisma koşulunun veritabanında göreceği ham alanlar; satır: önbellekteki hafif şekil.
const DB = [
  { id: "a", category: "Kristal", active: true, isFeatured: true, listPrice: 900, bulkMinQty: null, stocks: [3, 0] },
  { id: "b", category: "kristal", active: true, isFeatured: false, listPrice: null, bulkMinQty: 2, stocks: [0] },
  { id: "c", category: "Aksesuar", active: true, isFeatured: false, listPrice: null, bulkMinQty: null, stocks: [5] },
  { id: "d", category: "Modern", active: false, isFeatured: true, listPrice: null, bulkMinQty: null, stocks: [0] }, // "Tükendi" görünen pasif ürün
  { id: "e", category: "Modern", active: true, isFeatured: false, listPrice: null, bulkMinQty: null, stocks: [] },
  { id: "f", category: "KRISTAL", active: true, isFeatured: false, listPrice: 100, bulkMinQty: 3, stocks: [1] },
];
const ROWS = DB.map((p) => ({ id: p.id, rc: p.category, active: p.active, featured: p.isFeatured, inStock: p.stocks.some((s) => s > 0), disc: p.listPrice !== null || p.bulkMinQty !== null }));
const ids = (where) => ROWS.filter(rowFilter(where)).map((r) => r.id);

// Kategori sayfasının ürettiği koşullar (app/kategori/[slug]/page.tsx) ve veritabanının döndüreceği küme
const FEATURED = { category: { not: "Aksesuar" }, variations: { some: { stock: { gt: 0 } } } };
const DISCOUNTED = { OR: [{ listPrice: { not: null } }, { bulkMinQty: { not: null } }] };

test("bellekte süzme = veritabanı koşulu: tüm ürünler, tek yazım, çok yazım (harf duyarlı)", () => {
  assert.deepEqual(ids({}), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(ids(categoryWhere(["Kristal"])), ["a"]); // "kristal" ve "KRISTAL" ayrı yazımdır (Postgres eşitliği gibi)
  assert.deepEqual(ids(categoryWhere(["Kristal", "kristal", "KRISTAL"])), ["a", "b", "f"]);
  assert.deepEqual(ids(categoryWhere(["Modern"])), ["d", "e"]); // "Tükendi" görünen pasif ürün kategori sayfasında kalır
  assert.deepEqual(ids(categoryWhere(["Yok"])), []);
});

test("bellekte süzme = veritabanı koşulu: Öne Çıkanlar (elle / otomatik) ve İndirimli", () => {
  assert.deepEqual(ids({ active: true, isFeatured: true }), ["a"]); // pasif işaretli (d) girmez
  assert.deepEqual(ids({ active: true, ...FEATURED }), ["a", "f"]); // aksesuar ve stoksuzlar hariç
  assert.deepEqual(ids({ active: true, ...DISCOUNTED }), ["a", "b", "f"]);
});

test("sıra korunur (katalog sırası) ve liste çekirdeği aynı sonucu üretir", () => {
  const cats = [{ key: "kristal", slug: "kristal", title: "Kristal" }];
  const full = (r) => ({ ...r, cat: "kristal", price: 100, created: 1, updated: 1, vars: [] });
  const viaFilter = applyListing(ROWS.filter(rowFilter(categoryWhere(["Kristal", "kristal", "KRISTAL"]))).map(full), parseListingParams({}), { cats });
  const viaDb = applyListing(ROWS.filter((r) => ["Kristal", "kristal", "KRISTAL"].includes(r.rc)).map(full), parseListingParams({}), { cats });
  assert.deepEqual(viaFilter.ids, viaDb.ids);
  assert.deepEqual(viaFilter.ids, ["a", "f", "b"]); // çekirdek kuralı aynen: stoksuz (b) sona
});

test("tanınmayan koşul null döner (çağıran veritabanına düşer; yanlış süzme yapılmaz)", () => {
  for (const w of [null, [], { id: { in: ["a"] } }, { category: { contains: "Kri" } }, { category: { in: ["a"], not: "b" } }, { variations: { some: { stock: { gt: 1 } } } }, { OR: [{ active: true }] }, { active: "evet" }, { title: "x" }]) {
    assert.equal(rowFilter(w), null, JSON.stringify(w));
  }
});

test("Türkçe arama aynı: IŞIK = ışık = isik; açıklama başı (kırpılmış) aranır", () => {
  const row = { search: searchText(["Kristal Avize", "Kristal", "45 x 25", "Salon için ışık saçan model"]), mc: "12" };
  for (const q of ["IŞIK", "ışık", "isik", "kristal avize", "12"]) assert.ok(matchesSearch(row, q), q);
  assert.ok(!matchesSearch(row, "mutfak"));
});

test("liste katmanı: tek paylaşılan katalog girdisi, açıklama veritabanında kırpılır", () => {
  const s = src("lib/listing.ts");
  const select = s.slice(s.indexOf("const ROW_SELECT"), s.indexOf("satisfies Prisma.ProductSelect"));
  assert.ok(!/description/.test(select), "tam açıklama satır sorgusunda çekilmez");
  assert.match(s, /left\("description", \$\{SEARCH_DESCRIPTION_CHARS\}\)/);
  assert.match(s, /export const SEARCH_DESCRIPTION_CHARS = 300;/);
  assert.match(s, /const catalogRows = \(\) => loadRowsCached\(\{\}, LISTING_ROW_CAP\);/);
  // arama, kategori ve Çok Satanlar aynı girdiden beslenir
  assert.match(s, /const searchRows = async \(q: string\) => \(await catalogRows\(\)\)/);
  assert.match(s, /if \(test\) return \(await catalogRows\(\)\)\.filter\(test\)\.slice\(0, cap\);/);
  assert.match(s, /rows = await rowsForWhere\(base\.where, cap, base\.cached\);/);
  assert.ok(!/loadRows\(\{ id: \{ in: ids \} \}/.test(s), "Çok Satanlar için ayrı satır okuması yok");
  assert.match(s, /LISTING_ROWS_CACHE_SECONDS\)\.catch/);
  const k = src("lib/storefront-cache-key.ts");
  assert.match(k, /STOREFRONT_CACHE_VERSION = "v9"/);
  assert.match(k, /LISTING_ROWS_CACHE_SECONDS = 300/);
});

test("M9: ürün sayfası stoğu her istekte canlı okur (önbellek değişikliğinden etkilenmez)", () => {
  const page = src("app/urun/[id]/page.tsx");
  assert.match(page, /applyLiveStock\(cachedProduct, await getLiveStocks\(id\)/);
  assert.match(src("lib/products.ts"), /export const getLiveStocks = \(productId: string\) => prisma\.productVariation\.findMany/);
});
