import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES } from "../lib/site.ts";
import { buildCategoryList } from "../lib/categories.ts";
import { feedItemXml } from "../lib/feed.ts";
import {
  addRedirect,
  categoryDisplayTitle,
  isCategoryHidden,
  patchCategorySetting,
  planDelete,
  planRename,
  removeCollectionKey,
  removeRedirectsTo,
  renameCollectionKey,
  resolveCategoryRedirects,
  resolveCategorySettings,
  resolveRedirect,
  uncategorizedCount,
  validateDisplayTitle,
} from "../lib/category-settings.ts";

const rows = [
  { category: "Kristal", count: 5 },
  { category: "KRISTAL", count: 1 },
  { category: "Modern", count: 3 },
  { category: "yemek masası", count: 4 },
  { category: "Yemek Masası ", count: 2 },
  { category: "Lambader", count: 1 },
  { category: "", count: 7 },
];
const list = buildCategoryList(rows, CATEGORIES);

// ---- görünen ad / gizleme ----
test("görünen ad: ayar yoksa mevcut etiket aynen, varsa ayar", () => {
  assert.equal(categoryDisplayTitle({}, "klasik", "Klasik Koleksiyon"), "Klasik Koleksiyon");
  assert.equal(categoryDisplayTitle({ klasik: { title: "Klasik Seri" } }, "klasik", "Klasik Koleksiyon"), "Klasik Seri");
  assert.equal(categoryDisplayTitle({ klasik: { hidden: true } }, "klasik", "Klasik Avizeler"), "Klasik Avizeler");
});
test("gizleme ve varsayılana dönüş", () => {
  let s = patchCategorySetting({}, "modern", { hidden: true });
  assert.equal(isCategoryHidden(s, "modern"), true);
  s = patchCategorySetting(s, "modern", { title: "Çağdaş" });
  assert.deepEqual(s, { modern: { hidden: true, title: "Çağdaş" } });
  s = patchCategorySetting(s, "modern", { hidden: false });
  assert.deepEqual(s, { modern: { title: "Çağdaş" } });
  s = patchCategorySetting(s, "modern", { title: null });
  assert.deepEqual(s, {}); // boş kayıt tutulmaz = varsayılan
  assert.equal(isCategoryHidden(s, "modern"), false);
});
test("patchCategorySetting girdiyi değiştirmez", () => {
  const a = { modern: { title: "X" } };
  patchCategorySetting(a, "modern", { title: null });
  assert.deepEqual(a, { modern: { title: "X" } });
});
test("resolveCategorySettings: bozuk ham veri güvenle çözülür", () => {
  assert.deepEqual(resolveCategorySettings(null), {});
  assert.deepEqual(resolveCategorySettings({ categorySettings: "x" }), {});
  assert.deepEqual(resolveCategorySettings({ categorySettings: { a: { title: "  Yeni   Ad ", hidden: true }, b: { title: "" }, c: 5, d: { hidden: false } } }), { a: { title: "Yeni Ad", hidden: true } });
});
test("validateDisplayTitle: boş, uzun ve geçersiz karakter reddedilir", () => {
  assert.equal(validateDisplayTitle("  ").ok, false);
  assert.equal(validateDisplayTitle("a".repeat(61)).ok, false);
  assert.equal(validateDisplayTitle("a\u0001b").ok, false);
  assert.deepEqual(validateDisplayTitle(" Klasik   Koleksiyon "), { ok: true, title: "Klasik Koleksiyon" });
});

// ---- yeniden adlandırma planı ----
test("planRename: sabit kategori kilitli", () => {
  assert.equal(planRename(list, CATEGORIES, "kristal", "Yeni", false).ok, false);
});
test("planRename: başlık biçimi + boşluk sadeleştirme; varyantlar tek kayıt", () => {
  const p = planRename(list, CATEGORIES, "lambader", "  zemin   lambası ", false);
  assert.equal(p.ok && p.kind, "rename");
  assert.equal(p.newName, "Zemin Lambası");
  assert.equal(p.fromKey, "lambader");
  assert.equal(list.filter((c) => c.key === "yemek masasi").length, 1); // iki yazım tek kategori
});
test("planRename: boş, 60 karakterden uzun ve sabit adla çakışma reddedilir", () => {
  assert.equal(planRename(list, CATEGORIES, "lambader", "   ", false).ok, false);
  assert.equal(planRename(list, CATEGORIES, "lambader", "a".repeat(61), false).ok, false);
  assert.equal(planRename(list, CATEGORIES, "lambader", "a".repeat(60), false).ok, true);
  assert.equal(planRename(list, CATEGORIES, "lambader", "KRISTAL", false).ok, false);
  assert.equal(planRename(list, CATEGORIES, "lambader", "kristal serisi", false).ok, false);
  assert.equal(planRename(list, CATEGORIES, "lambader", "Sarkıt", false).ok, false);
});
test("planRename: mevcut kategoriyle aynı ad önce onay ister, onayda birleşir (hedefin yazımı)", () => {
  const need = planRename(list, CATEGORIES, "lambader", "YEMEK MASASI", false);
  assert.equal(need.ok && need.kind, "merge-needed");
  assert.equal(need.target.count, 6);
  const merged = planRename(list, CATEGORIES, "lambader", "YEMEK MASASI", true);
  assert.equal(merged.kind, "merge");
  assert.equal(merged.toKey, "yemek masasi");
  assert.equal(merged.newName, list.find((c) => c.key === "yemek masasi").title);
});
test("planRename: yalnızca harf biçimi değişimi birleşme sayılmaz", () => {
  const p = planRename(list, CATEGORIES, "yemek masasi", "YEMEK MASASI", false);
  assert.equal(p.kind, "rename");
  assert.equal(p.fromKey, p.toKey);
});

// ---- yönlendirme ----
const live = (...s) => new Set(["kristal", "modern", "klasik", "sarkit", "aksesuar", "tum", ...s]);
test("yönlendirme: tek adım eşleme", () => {
  assert.deepEqual(addRedirect({}, "a", "b", live("b")), { a: "b" });
});
test("yönlendirme: zincir oluşmaz (A→B sonra B→C ise A→C ve B→C)", () => {
  const r1 = addRedirect({}, "a", "b", live("b"));
  const r2 = addRedirect(r1, "b", "c", live("c"));
  assert.deepEqual(r2, { a: "c", b: "c" });
  assert.equal(resolveRedirect(r2, "a", live("c")), "c");
});
test("yönlendirme: canlı slug önceliklidir ve kendine yönlenme silinir", () => {
  const r = addRedirect({ a: "c" }, "x", "y", live("y", "a", "c")); // a artık canlı bir kategori
  assert.deepEqual(r, { x: "y" });
  assert.equal(resolveRedirect({ a: "b" }, "a", live("a", "b")), null); // canlı slug yönlendirilmez
});
test("yönlendirme: hedef canlı değilse 404 (null); silinen kategoriye ait eşlemeler kalkar", () => {
  assert.equal(resolveRedirect({ a: "b" }, "a", live()), null);
  assert.deepEqual(removeRedirectsTo({ a: "b", c: "d", b: "e" }, "b"), { c: "d" });
});
test("resolveCategoryRedirects: geçersiz ve kendine yönlenen girdiler atılır", () => {
  assert.deepEqual(resolveCategoryRedirects({ categoryRedirects: { a: "b", "B C": "x", z: "z", q: 3 } }), { a: "b" });
});

// ---- koleksiyon anahtarı ----
test("koleksiyon anahtarı yeniden adlandırmada güncellenir, birleşmede tekilleşir; silmede çıkar", () => {
  assert.deepEqual(renameCollectionKey(["a", "b", "c"], "b", "x"), ["a", "x", "c"]);
  assert.deepEqual(renameCollectionKey(["a", "b", "x"], "b", "x"), ["a", "x"]);
  assert.deepEqual(removeCollectionKey(["a", "b"], "a"), ["b"]);
});

// ---- silme ----
test("planDelete: sabit silinemez; diğerinde ürün sayısı döner", () => {
  assert.equal(planDelete(list, "modern").ok, false);
  assert.equal(planDelete(list, "yok").ok, false);
  assert.deepEqual(planDelete(list, "yemek masasi"), { ok: true, key: "yemek masasi", count: 6 });
});
test("kategorisiz ürünler: kategori listesinde çıkmaz, sayılır; feed'de product_type yazılmaz", () => {
  assert.ok(!list.some((c) => c.key === ""));
  assert.equal(uncategorizedCount([{ category: "" }, { category: "  " }, { category: "Modern" }]), 2);
  const item = { id: "p1", title: "Avize", description: "x", category: "", basePrice: 1000, listPrice: null, imageUrl: "/a.jpg", images: [], brand: null, variations: [{ extraPrice: 0, stock: 1 }] };
  const xml = feedItemXml(item, "https://www.yildirimavize.com.tr");
  assert.ok(xml && !xml.includes("product_type"));
  assert.match(xml, /<g:google_product_category>/);
  assert.match(feedItemXml({ ...item, category: "Modern" }, "https://www.yildirimavize.com.tr"), /<g:product_type>Modern<\/g:product_type>/);
});
