import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADMIN_LIST_PRODUCT_SELECT, ADMIN_LIST_VARIATION_SELECT, coverByRule, mergeImages, rowCover, variationSetSig, withCover } from "../lib/admin-product-list.ts";
import { coverImageOf } from "../lib/variation-input.ts";
import { quickFilterTest } from "../lib/admin-product-quick-filters.ts";
import { bulkTiersOf } from "../lib/bulk-pricing.ts";
import { uncategorizedCount } from "../lib/category-settings.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Aynı girdi → aynı kapak: SQL aynası (coverByRule) ve bileşenin kullandığı yol (withCover + coverImageOf) tam veriyle coverImageOf'a eşit
const CASES = {
  "images dolu": { images: ["/g1.jpg", "/g2.jpg"], imageUrl: "/eski.jpg", variations: [{ images: ["/r1.jpg"] }] },
  "images boş, imageUrl var": { images: [], imageUrl: "/eski.jpg", variations: [{ images: ["/r1.jpg"] }] },
  "ikisi boş, renk fotoğrafı var (ilk renkte yok)": { images: [], imageUrl: null, variations: [{ images: [] }, { images: ["/r2.jpg", "/r3.jpg"] }] },
  "hiç görsel yok": { images: [], imageUrl: null, variations: [{ images: [] }] },
  "boş dizgeler atlanır": { images: ["", "/g2.jpg"], imageUrl: "", variations: [{ images: ["", "/r1.jpg"] }] },
  "yalnız boş dizgeler": { images: [""], imageUrl: "", variations: [{ images: [""] }] },
  "renksiz ürün, imageUrl var": { images: [], imageUrl: "/eski.jpg", variations: [] },
};

for (const [name, c] of Object.entries(CASES)) {
  test(`kapak aynı: ${name}`, () => {
    const full = coverImageOf(c);
    assert.equal(coverByRule(c.images, c.imageUrl, c.variations.map((v) => v.images)), full);
    // Bileşen yolu: dar satıra kapak imageUrl olarak bindirilir, görsel dizileri yoktur
    const narrow = { id: "p1", variations: c.variations.map((_, i) => ({ id: `v${i}` })) };
    const [row] = withCover([narrow], new Map(full ? [["p1", full]] : []));
    assert.equal(coverImageOf({ imageUrl: row.imageUrl, variations: row.variations }), full);
    assert.equal(rowCover(row, undefined), full);
  });
}

test("kapak SQL'i coverImageOf ile aynı sırayı izler: images ilk dolu → imageUrl → ilk fotoğraflı rengin ilk fotoğrafı", () => {
  const s = src("lib/admin-product-covers.ts");
  const a = s.indexOf('unnest(p."images") WITH ORDINALITY');
  const b = s.indexOf('NULLIF(p."imageUrl", \'\')');
  const c = s.indexOf('FROM "ProductVariation" v, unnest(v."images") WITH ORDINALITY');
  assert.ok(a > 0 && b > a && c > b, "sıra: images, imageUrl, renk");
  assert.match(s, /t\.u <> '' ORDER BY t\.n LIMIT 1/); // dolu ilk eleman, dizi sırasıyla
  assert.match(s, /ORDER BY v\."position", v\."id", t\.n LIMIT 1/); // renk sırası listedeki ile aynı: position, id
  assert.match(s, /COALESCE\(/);
});

test("kapak sorgusu hata verirse liste kapaksız açılır ve hata günlüğe yazılır", () => {
  const s = src("lib/admin-product-covers.ts");
  assert.match(s, /catch \(error\)[\s\S]*console\.error\([\s\S]*return new Map\(\)/);
});

test("dar select: görsel dizileri, açıklama ve eşitleme alanları YOK; listenin kullandığı alanlar VAR", () => {
  const p = ADMIN_LIST_PRODUCT_SELECT;
  for (const k of ["images", "imageUrl", "description", "syncSnapshot", "lastSyncedAt", "brand", "trendyolUrl", "trendyolCategory"]) assert.ok(!(k in p), `ürün select'inde ${k} yok`);
  for (const k of ["id", "title", "category", "basePrice", "listPrice", "active", "isFeatured", "isBestSeller", "couponAllowed", "pickupDiscountPct", "transferDiscountPct", "bulkTiers", "trendyolMainId", "modelCode", "ebat"]) assert.equal(p[k], true, `ürün select'inde ${k} var`);
  const v = ADMIN_LIST_VARIATION_SELECT;
  for (const k of ["images", "syncSnapshot", "syncStock", "salePrice", "listPrice"]) assert.ok(!(k in v), `renk select'inde ${k} yok`);
  for (const k of ["id", "variationType", "variationValue", "extraPrice", "stock", "stockCode", "barcode"]) assert.equal(v[k], true, `renk select'inde ${k} var`);
  assert.deepEqual(p.variations.orderBy, [{ position: "asc" }, { id: "asc" }]);
});

test("liste çip/süzgeç/rozet mantığı dar sahte veriyle çalışır", () => {
  const rows = [
    { id: "a", title: "A", category: "Modern", basePrice: 0, listPrice: null, active: true, bulkTiers: null, modelCode: "1", variations: [{ id: "va", variationValue: "Krom", stock: 0, extraPrice: 0 }] },
    { id: "b", title: "B", category: "  ", basePrice: 900, listPrice: 1200, active: false, bulkTiers: [{ minQty: 2, type: "PERCENT", value: 10 }], modelCode: "2", variations: [{ id: "vb", variationValue: "Gold", stock: 4, extraPrice: 50 }] },
  ];
  assert.equal(quickFilterTest("outofstock", rows[0]), true);
  assert.equal(quickFilterTest("zeroprice", rows[0]), true);
  assert.equal(quickFilterTest("inactive", rows[1]), true);
  assert.equal(bulkTiersOf(rows[1]).length, 1);
  assert.equal(bulkTiersOf(rows[0]).length, 0);
  assert.equal(uncategorizedCount(rows), 1);
  // kupon / gizli çok satan seçenekleri aynı dizideki üç alandan türer
  assert.deepEqual(rows.map((r) => ({ id: r.id, title: r.title, modelCode: r.modelCode })), [{ id: "a", title: "A", modelCode: "1" }, { id: "b", title: "B", modelCode: "2" }]);
});

test("mergeImages: düzenleyiciye tam görseller bindirilir; kaydı olmayan renk boş fotoğraflı", () => {
  const p = { id: "p1", title: "T", variations: [{ id: "v1", variationValue: "Krom" }, { id: "v2", variationValue: "Gold" }] };
  const m = mergeImages(p, { imageUrl: "/a.jpg", images: ["/a.jpg", "/b.jpg"], variations: [{ id: "v1", images: ["/r.jpg"] }] });
  assert.deepEqual(m.images, ["/a.jpg", "/b.jpg"]);
  assert.deepEqual(m.variations.map((v) => v.images), [["/r.jpg"], []]);
  assert.equal(m.variations[1].variationValue, "Gold");
});

test("rowCover: tam veri gelince kapak ondan hesaplanır (kayıttan sonra güncel)", () => {
  const row = { imageUrl: "/eski.jpg", variations: [{ id: "v1" }] };
  assert.equal(rowCover(row, { imageUrl: "/yeni.jpg", images: ["/yeni.jpg"], variations: [{ id: "v1", images: [] }] }), "/yeni.jpg");
  assert.equal(rowCover(row, { imageUrl: null, images: [], variations: [{ id: "v1", images: ["/r.jpg"] }] }), "/r.jpg");
});

test("variationSetSig: renk eklenince/silinince değişir", () => {
  assert.notEqual(variationSetSig([{ id: "a" }]), variationSetSig([{ id: "a" }, { id: "b" }]));
  assert.equal(variationSetSig([{ id: "a" }, { id: "b" }]), variationSetSig([{ id: "a" }, { id: "b" }]));
});

test("panel sayfası: dar select + kapak sorgusu + ayrı kopyalanmamış sayacı; görsel dizileri sayfada okunmaz", () => {
  const page = src("app/admin/page.tsx");
  assert.match(page, /select: ADMIN_LIST_PRODUCT_SELECT/);
  assert.match(page, /loadAdminCovers\(\)/);
  assert.match(page, /prismaCopyStore\.count\?\.\(\[\]\)/);
  assert.match(page, /withCover\(productRows, covers\)/);
  assert.match(page, /uncopiedImages=\{uncopied\}/);
  assert.ok(!/\.images\b/.test(page), "sayfa ürün/renk görsel dizilerini okumaz");
  assert.ok(!/countUncopiedImages/.test(page));
});
