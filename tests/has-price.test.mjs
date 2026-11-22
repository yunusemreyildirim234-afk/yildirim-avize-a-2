import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const load = (p) => import("../" + p);

test("hasPrice: 0, negatif, boş, NaN false; pozitif true", async () => {
  const { hasPrice } = await load("lib/has-price.ts");
  for (const v of [0, -5, null, undefined, NaN, Infinity]) assert.equal(hasPrice(v), false);
  assert.equal(hasPrice(1), true);
  assert.equal(hasPrice(349.9), true);
});

test("kırıntı ve rozet: genel adlarda tekrar yok", async () => {
  const { crumbCategoryName, seriesBadge } = await load("lib/category-label.ts");
  assert.equal(crumbCategoryName("Yemek Masası Üstü Avizeler"), "Yemek Masası Üstü Avizeler");
  assert.equal(crumbCategoryName("Aplik Modelleri"), "Aplik Modelleri");
  assert.equal(crumbCategoryName("Kristal"), "Kristal Avizeler");
  assert.equal(seriesBadge("Yemek Masası Üstü Avizeler"), null);
  assert.equal(seriesBadge("Kristal"), "Kristal Serisi");
});

test("ürün sayfası ve kart: 0 fiyatta iletişim metni, PriceLadder koşullu", () => {
  const d = src("components/ProductDetailClient.tsx");
  assert.match(d, /!noPrice && <PriceLadder/);
  assert.match(d, /PRICE_CONTACT_TEXT/);
  const c = src("components/ProductCard.tsx");
  assert.match(c, /PRICE_CONTACT_TEXT/);
});

test("fırsat bandı stoksuz ürünü çıkarır", () => {
  assert.match(src("lib/homepage-compose.ts") + src("app/page.tsx") + src("app/home-more.tsx"), /stock\s*>\s*0/);
});
