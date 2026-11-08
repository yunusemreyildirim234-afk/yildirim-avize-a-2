import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STOCKLESS_RULE, effectiveShow, isProductVisible, isShownAsSoldOut, resolveStocklessRule, stocklessEnabled, stocklessShown, visibleWhere } from "../lib/stockless.ts";
import { patchCategorySetting, resolveCategorySettings } from "../lib/category-settings.ts";
import { applyListing, parseListingParams, stateToParams, hasFilters } from "../lib/listing-core.ts";

const rule = (global, byCategory = {}) => ({ global, byCategory });
const P = (active, totalStock, category = "Kristal") => ({ active, totalStock, category });

test("görünürlük tablosu: aktif/pasif × stoklu/stoksuz × genel/kategori ayarı", () => {
  const cases = [
    // [ürün, kural, beklenen]
    [P(true, 5), rule(false), true],
    [P(true, 0), rule(false), true], // aktif stoksuz zaten görünür
    [P(false, 5), rule(false), false],
    [P(false, 0), rule(false), false], // varsayılan KAPALI: eski davranış
    [P(false, 0), rule(true), true],
    [P(false, 5), rule(true), false], // pasif + stoklu hep gizli
    [P(false, 0), rule(false, { kristal: "show" }), true],
    [P(false, 0), rule(true, { kristal: "hide" }), false], // kategori Gizle genel Göster'i ezer
    [P(false, 0, "Modern"), rule(true, { kristal: "hide" }), true], // başka kategori etkilenmez
    [P(false, 0, "KRİSTAL"), rule(true, { kristal: "hide" }), false], // harf varyantı
    [P(false, 5), rule(false, { kristal: "show" }), false],
    [P(true, 0), rule(true, { kristal: "hide" }), true], // aktif ürüne ayar dokunmaz
  ];
  for (const [p, r, want] of cases) assert.equal(isProductVisible(p, r), want, JSON.stringify([p, r]));
  assert.equal(isShownAsSoldOut(P(true, 0), rule(true)), false);
  assert.equal(isShownAsSoldOut(P(false, 0), rule(true)), true);
});

test("ayar çözümü ve etkili ayar", () => {
  assert.deepEqual(resolveStocklessRule(null), DEFAULT_STOCKLESS_RULE);
  assert.deepEqual(resolveStocklessRule({}), DEFAULT_STOCKLESS_RULE);
  const r = resolveStocklessRule({ showStockless: true, categorySettings: { aplik: { stockless: "hide" }, modern: { stockless: "show" }, x: { stockless: "bozuk" } } });
  assert.equal(r.global, true);
  assert.deepEqual(r.byCategory, { aplik: "hide", modern: "show" });
  assert.equal(effectiveShow(r, "aplik"), false);
  assert.equal(effectiveShow(r, "modern"), true);
  assert.equal(effectiveShow(r, "kristal"), true);
  assert.equal(effectiveShow(resolveStocklessRule({ showStockless: "true" }), "kristal"), false); // yalnızca boolean true
  assert.equal(stocklessEnabled(DEFAULT_STOCKLESS_RULE), false);
  assert.equal(stocklessEnabled(rule(false, { a: "hide" })), false);
  assert.equal(stocklessEnabled(rule(false, { a: "show" })), true);
});

test("kategori ayarı: stockless yazılır/silinir, diğer alanlar korunur, boşalan kayıt kalkar", () => {
  let s = patchCategorySetting({}, "kristal", { stockless: "show" });
  assert.deepEqual(s, { kristal: { stockless: "show" } });
  s = patchCategorySetting(s, "kristal", { title: "Kristal Avize" });
  assert.deepEqual(s.kristal, { stockless: "show", title: "Kristal Avize" });
  s = patchCategorySetting(s, "kristal", { title: null, hidden: null }); // "Varsayılana dön" stockless'a dokunmaz
  assert.deepEqual(s.kristal, { stockless: "show" });
  s = patchCategorySetting(s, "kristal", { stockless: null });
  assert.deepEqual(s, {});
  assert.deepEqual(resolveCategorySettings({ categorySettings: { a: { stockless: "x" } } }), {});
});

test("sorgu parçası: ayar kapalıyken eski koşul, açıkken OR", () => {
  assert.deepEqual(visibleWhere([]), { active: true });
  const w = visibleWhere(["Kristal", "KRISTAL"]);
  assert.deepEqual(w.OR[0], { active: true });
  assert.deepEqual(w.OR[1], { variations: { none: { stock: { gt: 0 } } }, category: { in: ["Kristal", "KRISTAL"] } });
});

test("kategori sayıları: yalnızca etkili 'göster' kategorilerin stoksuz satırları sayıya girer", () => {
  const rows = [{ category: "Kristal", count: 3 }, { category: "Aplik", count: 2 }, { category: "", count: 9 }];
  const out = stocklessShown(rule(true, { aplik: "hide" }), rows);
  assert.deepEqual(out.spellings, ["Kristal"]);
  assert.deepEqual(out.rows, [{ category: "Kristal", count: 3 }]);
  assert.deepEqual(stocklessShown(rule(false), rows).spellings, []);
});

// ---- Liste çekirdeği: stoklu önce + ?stok=var ----
const row = (id, price, inStock, extra = {}) => ({ id, cat: "kristal", price, created: 0, updated: 0, featured: false, vars: [], inStock, ...extra });
const ctx = { cats: [{ key: "kristal", slug: "kristal", title: "Kristal" }] };
const rows = [row("a", 300, false), row("b", 100, true), row("c", 200, false), row("d", 400, true), row("e", 50, true)];

test("stoklu ürünler her sıralamada önde; grup içi seçili sıraya göre", () => {
  const asc = applyListing(rows, parseListingParams({ siralama: "fiyat-artan" }), ctx).ids;
  assert.deepEqual(asc, ["e", "b", "d", "c", "a"]);
  const desc = applyListing(rows, parseListingParams({ siralama: "fiyat-azalan" }), ctx).ids;
  assert.deepEqual(desc, ["d", "b", "e", "a", "c"]);
  const def = applyListing(rows, parseListingParams({}), ctx).ids;
  assert.deepEqual(def, ["b", "d", "e", "a", "c"]); // varsayılan sıra grup içinde korunur
  // stoksuz yoksa (veya inStock alanı yoksa) sıra eskisiyle aynı
  const legacy = rows.map(({ inStock, ...r }) => r);
  assert.deepEqual(applyListing(legacy, parseListingParams({ siralama: "fiyat-artan" }), ctx).ids, ["e", "b", "c", "a", "d"]);
});

test("?stok=var: yalnızca stoklular, sayılar da bu kümeye göre; hasSoldOut doğru", () => {
  const st = parseListingParams({ stok: "var" });
  assert.equal(st.stok, true);
  assert.equal(hasFilters(st), true);
  assert.deepEqual(stateToParams(st), { stok: "var" });
  const res = applyListing(rows, st, ctx);
  assert.deepEqual(res.ids, ["b", "d", "e"]);
  assert.equal(res.hasSoldOut, true);
  assert.equal(res.facets.categories[0].count, 3);
  assert.equal(applyListing(rows, parseListingParams({}), ctx).facets.categories[0].count, 5); // varsayılanda sayılar stoksuzları içerir
  assert.equal(parseListingParams({ stok: "yok" }).stok, undefined);
  assert.equal(applyListing(rows.filter((r) => r.inStock), parseListingParams({}), ctx).hasSoldOut, false);
});
