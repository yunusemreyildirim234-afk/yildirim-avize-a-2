import test from "node:test";
import assert from "node:assert/strict";
import { hasZeroPrice, isInactive, isOutOfStock, isQuickFilterKey, quickFilterTest } from "../lib/admin-product-quick-filters.ts";

const p = (basePrice, stocks, active) => ({ basePrice, active, variations: stocks.map((stock) => ({ stock })) });

test("Stoksuz: tüm varyasyonlar 0 veya eksi ise", () => {
  assert.equal(isOutOfStock(p(100, [0, 0])), true);
  assert.equal(isOutOfStock(p(100, [0, -2])), true);
  assert.equal(isOutOfStock(p(100, [0, 3])), false);
  assert.equal(isOutOfStock(p(100, [])), true);
});

test("Fiyatı 0: sıfır, eksi ve geçersiz fiyat", () => {
  assert.equal(hasZeroPrice(p(0, [1])), true);
  assert.equal(hasZeroPrice(p(-5, [1])), true);
  assert.equal(hasZeroPrice(p(Number.NaN, [1])), true);
  assert.equal(hasZeroPrice(p(1250, [1])), false);
});

test("Pasif: yalnızca active === false (alan yoksa aktif sayılır)", () => {
  assert.equal(isInactive(p(1, [1], false)), true);
  assert.equal(isInactive(p(1, [1], true)), false);
  assert.equal(isInactive(p(1, [1])), false);
});

test("quickFilterTest anahtara göre yönlendirir; anahtar tanıma", () => {
  assert.equal(quickFilterTest("outofstock", p(1, [0])), true);
  assert.equal(quickFilterTest("zeroprice", p(1, [0])), false);
  assert.equal(quickFilterTest("inactive", p(1, [0], false)), true);
  assert.equal(isQuickFilterKey("zeroprice"), true);
  assert.equal(isQuickFilterKey("discount"), false);
});
