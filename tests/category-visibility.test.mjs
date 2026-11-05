import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES } from "../lib/site.ts";
import { VISIBLE_PRODUCT_WHERE, buildCategoryList, visibleCategoryWhere, withEmptyHidden, withVisibleProducts } from "../lib/categories.ts";

const rows = (extra = []) => [
  { category: "Kristal", count: 5 },
  { category: "Modern", count: 3 },
  { category: "Klasik", count: 2 },
  { category: "Sarkıt", count: 1 },
  ...extra,
];
const slugs = (l) => withVisibleProducts(l).map((c) => c.slug);

test("görünür ürün tanımı tek: aktif ürün; kategori sayfası filtresi bunu içerir", () => {
  assert.deepEqual(VISIBLE_PRODUCT_WHERE, { active: true });
  assert.deepEqual(visibleCategoryWhere(["Modern"]), { active: true, category: "Modern" });
  assert.deepEqual(visibleCategoryWhere(["Modern", "MODERN"]), { active: true, category: { in: ["Modern", "MODERN"] } });
});

test("sabit kategori: 0 görünür ürün -> bağlantı listelerinden gizlenir, 1 ürün gelince geri gelir", () => {
  const empty = buildCategoryList(rows(), CATEGORIES); // Aksesuar'ın ürünü yok
  assert.equal(empty.find((c) => c.slug === "aksesuar").count, 0);
  assert.equal(withEmptyHidden({}, empty).aksesuar.hidden, true);
  assert.ok(!slugs(empty).includes("aksesuar"));
  // sayfa adresi kaybolmaz: liste kaydı durur (sayfa boş durum mesajıyla çalışır)
  assert.ok(empty.some((c) => c.slug === "aksesuar"));

  const back = buildCategoryList(rows([{ category: "Aksesuar", count: 1 }]), CATEGORIES);
  assert.equal(withEmptyHidden({}, back).aksesuar, undefined);
  assert.ok(slugs(back).includes("aksesuar"));
});

test("sabit kategori: yönetici ayarları korunur, otomatik gizleme üstüne eklenir", () => {
  const empty = buildCategoryList(rows(), CATEGORIES);
  const out = withEmptyHidden({ aksesuar: { title: "Yedek Parça" }, modern: { title: "Çağdaş" } }, empty);
  assert.deepEqual(out.aksesuar, { title: "Yedek Parça", hidden: true });
  assert.deepEqual(out.modern, { title: "Çağdaş" });
});

test("dinamik kategori: 0 görünür ürün -> gizlenir, 1 ürün gelince geri gelir", () => {
  const zero = buildCategoryList(rows([{ category: "Lambader", count: 0 }]), CATEGORIES);
  assert.ok(zero.some((c) => c.title === "Lambader")); // kayıt durur
  assert.ok(!withVisibleProducts(zero).some((c) => c.title === "Lambader"));
  const one = buildCategoryList(rows([{ category: "Lambader", count: 1 }]), CATEGORIES);
  assert.ok(withVisibleProducts(one).some((c) => c.title === "Lambader"));
});

test("sayı tutarlılığı: birleşmiş yazımlar tek sayı verir (sayfadaki ürün sayısıyla aynı küme)", () => {
  const l = buildCategoryList(rows([{ category: "Yemek Masası", count: 2 }, { category: "yemek masası", count: 3 }]), CATEGORIES);
  const e = l.find((c) => c.title.toLowerCase().startsWith("yemek"));
  assert.equal(e.count, 5);
  assert.deepEqual(visibleCategoryWhere(e.spellings).category.in.sort(), ["Yemek Masası", "yemek masası"].sort());
});

test("veritabanı hatası (liste yok): ayarlar aynen kalır, sabit yedek liste değişmez", () => {
  const overrides = { klasik: { title: "Klasik Seri" } };
  assert.deepEqual(withEmptyHidden(overrides, null), overrides);
  assert.deepEqual(withEmptyHidden({}, null), {});
});
