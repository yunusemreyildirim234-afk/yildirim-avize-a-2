import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("bağ yokken (liste boş) öneri bileşenleri hiçbir şey çizmez", () => {
  const c = src("components/ComplementSuggestions.tsx");
  assert.match(c, /if \(suggestions\.length === 0\) return null;/);
  assert.equal((c.match(/length === 0\) return null/g) ?? []).length, 2); // kart listesi ve ürün sayfası sarmalayıcısı
});

test("ürün sayfası: bölüm WhatsApp bölümüne dokunmadan ProductDetailClient'ten sonra, hata olursa sayfa açılır", () => {
  const p = src("app/urun/[id]/page.tsx");
  assert.match(p, /getProductComplements\(product\.id\)\.catch\(\(\) => \(\{ suggestions: \[\], count: null \}\)\)/);
  assert.ok(p.indexOf("<ProductDetailClient") < p.indexOf("<ProductPageComplements"));
  assert.equal(/ComplementSuggestions|getProductComplements/.test(src("components/ProductDetailClient.tsx")), false);
});

test("sepet: öneri isteği yalnız ürün kümesi anahtarına bağlı tek efekt; adres sıralı kimliklerden", () => {
  const s = src("app/sepet/page.tsx");
  assert.match(s, /\[\.\.\.new Set\(cart\.map\(\(i\) => i\.productId\)\)\]\.sort\(\)\.join\(","\)/);
  const fetches = s.match(/\/api\/cart\/complements/g) ?? [];
  assert.equal(fetches.length, 1);
  assert.match(s, /\}, \[productSetKey\]\);/);
  assert.match(s, /<ComplementSuggestions suggestions=\{shownSuggestions\}/);
});

test("sepet: indirim etiketi ve 'kalktı' bildirimi mevcut priceNotice kutusunu kullanır", () => {
  const s = src("app/sepet/page.tsx");
  assert.match(s, /bundleLineView\(pricedOf/);
  assert.match(s, /lostBundleTitles\(/);
  assert.match(s, /setPriceNotice\(\{ from: prev\.totals\.total, to: q\.totals\.total, bundleLost: lost \}\)/);
  assert.match(s, /Birlikte alma indirimi kalktı:/);
});

test("kart: ürün bağlantıları productPath ile, çok varyasyonda seçici, tek varyasyonda doğrudan ekleme", () => {
  const c = src("components/ComplementSuggestions.tsx");
  assert.match(c, /productPath\(\{ id: s\.productId, title: s\.title \}\)/);
  assert.match(c, /const single = s\.variations\.length === 1;/);
  assert.match(c, /onClick=\{single \|\| picking \? add : \(\) => setPicking\(true\)\}/);
});
