import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { mapCategory } = await import("../lib/trendyol.ts");
const kat = (title, categoryName = "") => mapCategory({ title, categoryName });

test("mapCategory: halka/tabak/top kelimesi avizeyi aksesuar yapmaz", () => {
  assert.equal(kat("Halkalı Kristal Avize 6 Kollu"), "Kristal");
  assert.equal(kat("Tabaklı Modern Avize"), "Modern");
  assert.equal(kat("Top Avize Klasik 5'li"), "Klasik");
  assert.equal(kat("Kristal Küre Top", "Avize"), "Kristal");
});

test("mapCategory: gerçek yedek parçalar aksesuar kalır", () => {
  assert.equal(kat("Avize Taşı Kristal 40 mm"), "Aksesuar");
  assert.equal(kat("Avize Halkası Metal"), "Aksesuar");
  assert.equal(kat("Avize Tabağı Cam"), "Aksesuar");
  assert.equal(kat("Kristal Top Taş"), "Aksesuar");
  assert.equal(kat("Metal Halka Aparatı"), "Aksesuar");
  assert.equal(kat("Cam Tabak Yedek"), "Aksesuar");
  assert.equal(kat("LED Ampul E14", "Ampul"), "Aksesuar");
  assert.equal(kat("Avize Duyu E27"), "Aksesuar");
});

test("mapCategory: mevcut kurallar bozulmaz", () => {
  assert.equal(kat("Kontes Avize"), "Klasik");
  assert.equal(kat("Modern Aplik"), "Sarkıt");
  assert.equal(kat("Kristal Avize"), "Kristal");
});
