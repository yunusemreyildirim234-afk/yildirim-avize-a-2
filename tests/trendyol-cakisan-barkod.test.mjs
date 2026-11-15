import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { cakisanBarkodlar, kalkanPlani } = await import("../lib/trendyol-kalkan.ts");
const { GROUPS } = await import("../lib/trendyol-plan.ts");

const g = (mainId, ...codes) => ({ mainId, title: `Ürün ${mainId}`, variations: codes.map((barcode) => ({ barcode })) });
const m = (mainId, ...codes) => ({ trendyolMainId: mainId, title: `Site ${mainId}`, variations: codes.map((barcode) => ({ barcode })) });

test("çakışma yoksa liste boş; boş barkod sayılmaz", () => {
  assert.deepEqual(cakisanBarkodlar([g("A", "1", "2"), g("B", "3", "")], []), []);
});

test("ürünler arası tekrar: iki ürün listelenir, sitede tutan ürün gösterilir", () => {
  const r = cakisanBarkodlar([g("A", "X"), g("B", "X", "Y")], [m("A", "X")]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].urunler.map((u) => [u.mainId, u.adet]), [["A", 1], ["B", 1]]);
  assert.deepEqual(r[0].sitede, { mainId: "A", baslik: "Site A" });
});

test("ürün içi tekrar: tek üründe adet 2; sitede yoksa null; boşluk yok sayılır; barkoda göre sıralı", () => {
  const r = cakisanBarkodlar([g("A", "Z", " Z", "K", "K ")], []);
  assert.deepEqual(r.map((c) => [c.barkod, c.urunler[0].adet, c.sitede]), [["K", 2, null], ["Z", 2, null]]);
});

test("kalkanPlani sonucu çakışanları taşır ve STOCK=SKIP iken de verir", () => {
  const ayar = Object.fromEntries(GROUPS.map((x) => [x, x === "STOCK" ? "SKIP" : "KEEP"]));
  const k = kalkanPlani([], [{ ...g("A", "X"), variations: [{ barcode: "X" }] }, g("B", "X")], new Set(), {}, ayar);
  assert.deepEqual(k.cakisanBarkodlar.map((c) => c.barkod), ["X"]);
});
