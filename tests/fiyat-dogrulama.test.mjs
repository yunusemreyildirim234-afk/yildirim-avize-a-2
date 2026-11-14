import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validPrice, validExtraPrice, discountedPrice, MAX_PRICE } from "../lib/price-input.ts";
import { validateDirty } from "../lib/editor-dirty.ts";
import { MAX_EXTRA_PRICE } from "../lib/variation-input.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("validPrice: 0, negatif, NaN, 10.000.000 üstü, 3 ondalık ve sayı olmayan reddedilir", () => {
  for (const p of [0, -1, NaN, Infinity, 10_000_000.01, 1.005, "100", null, undefined]) assert.equal(validPrice(p), false, String(p));
  for (const p of [0.01, 1, 349.9, 12500, 10_000_000]) assert.equal(validPrice(p), true, String(p));
});

test("validExtraPrice: 0 serbest, üst sınır 10.000.000, negatif ve 3 ondalık reddedilir", () => {
  for (const p of [-0.01, 10_000_001, NaN, 1.234]) assert.equal(validExtraPrice(p), false, String(p));
  for (const p of [0, 25, 10_000_000]) assert.equal(validExtraPrice(p), true, String(p));
  assert.equal(MAX_EXTRA_PRICE, MAX_PRICE);
});

test("toplu indirim: sonucu 0 veya altına inen validPrice'tan geçmez (atlanır); normal indirim geçer", () => {
  assert.equal(validPrice(discountedPrice(100, "FIXED", 100)), false);
  assert.equal(validPrice(discountedPrice(100, "FIXED", 150)), false);
  assert.equal(validPrice(discountedPrice(0.01, "PERCENT", 99)), false);
  assert.equal(discountedPrice(1000, "PERCENT", 10), 900);
  assert.equal(validPrice(discountedPrice(1000, "FIXED", 999)), true);
});

test("düzenleyici: fiyat 0 ve negatif kaydetmeden önce reddedilir", () => {
  const form = (basePrice) => ({ info: { title: "A", basePrice, modelCode: "", ebat: "", isFeatured: false, isBestSeller: false }, vars: {}, images: [] });
  const d = { info: true, vars: [] };
  assert.deepEqual(validateDirty(form("0"), d, () => ""), ["Fiyat 0 olamaz."]);
  assert.equal(validateDirty(form("-5"), d, () => "").length, 1);
  assert.equal(validateDirty(form("1500"), d, () => "").length, 0);
});

test("API: fiyat doğrulaması merkezi yardımcıdan; listPrice temizlenir; toplu indirim 0'a düşeni atlar", () => {
  const product = read("app/api/admin/product/route.ts");
  assert.match(product, /validPrice\(basePrice\)/);
  assert.match(product, /validPrice\(price\)/);
  assert.match(product, /validExtraPrice\(Number\(body\.extraPrice\)\)/);
  assert.match(product, /data\.basePrice >= cur\.listPrice\) data\.listPrice = null/);
  const bulk = read("app/api/admin/product/bulk/route.ts");
  assert.match(bulk, /zeroed/);
  assert.match(bulk, /!validPrice\(next\) \|\| next >= original/);
  assert.match(bulk, /validExtraPrice\(extraPrice\)/);
  assert.match(read("components/AdminBulkBar.tsx"), /0 ₺ veya altına ineceği için atlandı/);
  assert.match(read("components/AdminProductEditor.tsx"), /type="number" min=\{1\} value=\{basePrice\}/);
});
