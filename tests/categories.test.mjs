import test from "node:test";
import assert from "node:assert/strict";
import { slugifyTr, categoryKey, mergeCategories, buildCategoryList, findDynamicCategory } from "../lib/categories.ts";

// lib/site.ts CATEGORIES ile aynı (sıra, slug, ad): sabit liste değişirse bu test de bilinçli güncellenmeli
const FIXED = [
  { slug: "kristal", title: "Kristal Serisi", dbCategory: "Kristal" },
  { slug: "modern", title: "Modern Avizeler", dbCategory: "Modern" },
  { slug: "klasik", title: "Klasik Avizeler", dbCategory: "Klasik" },
  { slug: "sarkit", title: "Sarkıt & Aplik Modelleri", dbCategory: "Sarkıt" },
  { slug: "aksesuar", title: "Aksesuar & Yedek Parça", dbCategory: "Aksesuar" },
];

test("slug: Türkçe karakterler, & ve özel karakterler", () => {
  assert.equal(slugifyTr("Yemek Masası Üstü Avizeler"), "yemek-masasi-ustu-avizeler");
  assert.equal(slugifyTr("Çığ Öşü Ğ"), "cig-osu-g");
  assert.equal(slugifyTr("İSTANBUL IŞIK"), "istanbul-isik");
  assert.equal(slugifyTr("Sarkıt & Aplik"), "sarkit-aplik");
  assert.equal(slugifyTr("  --Led / Spot!!  "), "led-spot");
  assert.equal(slugifyTr("&&&"), "kategori");
});

test("anahtar: büyük/küçük harf ve boşluk farkı tek kategori (İ/ı doğru)", () => {
  assert.equal(categoryKey("YEMEK MASASI"), categoryKey("Yemek  Masası "));
  assert.equal(categoryKey("ISIK"), "ısık");
  assert.equal(categoryKey("İŞ"), "iş");
});

test("birleştirme: en sık yazım görünen ad, tüm yazımlar korunur", () => {
  const m = mergeCategories([
    { category: "Yemek Masası", count: 5 },
    { category: "YEMEK MASASI", count: 2 },
    { category: "yemek masası", count: 1 },
    { category: "Led", count: 3 },
    { category: "  ", count: 9 },
  ]);
  assert.equal(m.length, 2);
  const y = m.find((x) => x.key === "yemek masası");
  assert.equal(y.name, "Yemek Masası");
  assert.equal(y.count, 8);
  assert.deepEqual(y.spellings, ["Yemek Masası", "YEMEK MASASI", "yemek masası"]);
});

test("sabit liste adı, slug'ı ve sırasıyla aynen korunur; ürün olmasa da başta yer alır", () => {
  const list = buildCategoryList([{ category: "Modern", count: 4 }], FIXED);
  assert.deepEqual(list.slice(0, 5).map((c) => [c.slug, c.title, c.fixed]), FIXED.map((f) => [f.slug, f.title, true]));
  assert.deepEqual(list.slice(0, 5).map((c) => c.spellings[0]), FIXED.map((f) => f.dbCategory));
  assert.equal(list.length, 5);
});

test("yeni kategoriler sabitlerin ARKASINA, ürün sayısına göre azalan; sabit varyantı çoğaltılmaz", () => {
  const list = buildCategoryList(
    [
      { category: "Modern", count: 4 },
      { category: "MODERN", count: 1 },
      { category: "Led", count: 2 },
      { category: "Yemek Masası Üstü Avizeler", count: 7 },
      { category: "YEMEK MASASI ÜSTÜ AVİZELER", count: 1 },
    ],
    FIXED
  );
  assert.deepEqual(list.slice(0, 5).map((c) => c.slug), FIXED.map((f) => f.slug));
  assert.deepEqual(list.slice(5).map((c) => c.title), ["Yemek Masası Üstü Avizeler", "Led"]);
  assert.equal(list[5].slug, "yemek-masasi-ustu-avizeler");
  assert.equal(list[5].count, 8);
  assert.equal(list[5].spellings.length, 2);
  assert.equal(list.filter((c) => c.title.toLowerCase() === "modern").length, 0);
});

test("slug çakışması: sayı eklenir; sabit/ayrılmış slug'larla çakışmaz", () => {
  const list = buildCategoryList(
    [
      { category: "Led Aydınlatma", count: 3 },
      { category: "Led Aydinlatma", count: 2 },
      { category: "Tüm", count: 1 },
      { category: "Kristal!", count: 1 },
    ],
    FIXED
  );
  const dyn = list.filter((c) => !c.fixed);
  assert.deepEqual(dyn.map((c) => [c.title, c.slug]), [["Led Aydınlatma", "led-aydinlatma"], ["Led Aydinlatma", "led-aydinlatma-2"], ["Kristal!", "kristal-2"], ["Tüm", "tum-2"]]);
  assert.equal(new Set(list.map((c) => c.slug)).size, list.length);
});

test("findDynamicCategory: sabit ve bilinmeyen slug bulunmaz (404/sabit yol)", () => {
  const list = buildCategoryList([{ category: "Led", count: 1 }], FIXED);
  assert.equal(findDynamicCategory(list, "led")?.title, "Led");
  assert.equal(findDynamicCategory(list, "modern"), null);
  assert.equal(findDynamicCategory(list, "yok"), null);
});

test("kanıt: lib/site.ts CATEGORIES ile test içindeki sabit liste birebir aynı ve buildCategoryList onu aynen önde verir", async () => {
  const { CATEGORIES } = await import("../lib/site.ts");
  assert.deepEqual(CATEGORIES.map((c) => ({ slug: c.slug, title: c.title, dbCategory: c.dbCategory })), FIXED);
  const list = buildCategoryList([{ category: "Yeni", count: 1 }], CATEGORIES);
  assert.deepEqual(list.slice(0, CATEGORIES.length).map((c) => c.slug), CATEGORIES.map((c) => c.slug));
});
