import test from "node:test";
import assert from "node:assert/strict";

const { formatCarrierPriceText } = await import("../lib/carrier-price-display.ts");

test("ham fiyat Türkçe para biçimine çevrilir (2 ondalık)", () => {
  assert.equal(formatCarrierPriceText("132.948"), "132,95 ₺");
  assert.equal(formatCarrierPriceText("115.22844"), "115,23 ₺");
  assert.equal(formatCarrierPriceText("22.67 + KDV"), "22,67 ₺ + KDV");
  assert.equal(formatCarrierPriceText("1234.5"), "1.234,50 ₺");
});

test("sayı yoksa metin aynen kalır", () => {
  assert.equal(formatCarrierPriceText("Hizmet Dışı Bölge"), "Hizmet Dışı Bölge");
  assert.equal(formatCarrierPriceText(""), "");
});
