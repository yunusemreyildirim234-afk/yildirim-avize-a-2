import test from "node:test";
import assert from "node:assert/strict";
import { buildIncoming } from "../lib/trendyol.ts";

// MEVCUT davranışı tanımlar; bulunan sorunlar rapora yazılır, burada düzeltme beklenmez.
const it = (o = {}) => ({ barcode: "B1", title: "Kristal Avize", productMainId: "M1", quantity: 3, salePrice: 100, listPrice: 120, onSale: true, approved: true, archived: false, blacklisted: false, images: [{ url: "https://x/1.jpg" }], categoryName: "Avize", ...o });
const attr = (renk, ebat) => [{ attributeName: "Renk", attributeValue: renk }, ...(ebat ? [{ attributeName: "Boyut/Ebat", attributeValue: ebat }] : [])];

test("barkodsuz kayıt atlanır; yalnız barkodsuz ürün hiç üretilmez", () => {
  const out = buildIncoming([it({ barcode: "" }), it({ barcode: undefined, productMainId: "M2" }), it({ barcode: "B3", productMainId: "M3" })]);
  assert.deepEqual(out.map((p) => p.mainId), ["M3"]);
  const m = buildIncoming([it({ barcode: "B1" }), it({ barcode: "", attributes: attr("Kırmızı") })]);
  assert.equal(m[0].variations.length, 1);
});

test("aynı ürün, çift barkod: iki varyasyon üretilir, etiketler ayrışır (barkod tekrarı korunmaz)", () => {
  const [p] = buildIncoming([it({ barcode: "AAA1111" }), it({ barcode: "AAA1111" })]);
  assert.equal(p.variations.length, 2);
  assert.equal(p.variations[0].variationValue, "Standart");
  assert.equal(p.variations[1].variationValue, "Standart (1111)");
});

test("fiyatı 0 olan kayıt satılabilir bir kardeşi varsa havuza girmez", () => {
  const [p] = buildIncoming([it({ barcode: "B1", salePrice: 0, attributes: attr("Altın") }), it({ barcode: "B2", salePrice: 80, attributes: attr("Gümüş") })]);
  assert.deepEqual(p.variations.map((v) => v.barcode), ["B2"]);
  assert.equal(p.basePrice, 80);
  assert.equal(p.active, true);
});

test("tüm kayıtların fiyatı 0: ürün pasif ve taban fiyat 0 gelir (satışa açılmaması başka katmanın işi)", () => {
  const [p] = buildIncoming([it({ salePrice: 0, listPrice: 0 })]);
  assert.equal(p.active, false);
  assert.equal(p.basePrice, 0);
  assert.equal(p.listPrice, null);
});

test("görselsiz kayıt: images boş, ürün yine üretilir; görseller tekilleştirilir", () => {
  const [a] = buildIncoming([it({ images: undefined })]);
  assert.deepEqual(a.images, []);
  const [b] = buildIncoming([it({ barcode: "B1" }), it({ barcode: "B2", images: [{ url: "https://x/1.jpg" }, { url: "https://x/2.jpg" }] })]);
  assert.deepEqual(b.images, ["https://x/1.jpg", "https://x/2.jpg"]);
});

test("pasif/arşivli/kara listeli kayıtlar: satılabilir yoksa ürün pasif, varsa dışarıda kalır", () => {
  assert.equal(buildIncoming([it({ onSale: false })])[0].active, false);
  assert.equal(buildIncoming([it({ archived: true })])[0].active, false);
  const [p] = buildIncoming([it({ barcode: "B1" }), it({ barcode: "B2", blacklisted: true })]);
  assert.deepEqual(p.variations.map((v) => v.barcode), ["B1"]);
});

test("stok eksi/eksikse 0; liste fiyatı yalnız taban fiyattan büyükse tutulur; fark ek fiyata yazılır", () => {
  const [p] = buildIncoming([
    it({ barcode: "B1", quantity: -5, salePrice: 100, listPrice: 100, attributes: attr("Altın") }),
    it({ barcode: "B2", quantity: undefined, salePrice: 130, listPrice: 100, attributes: attr("Gümüş", "80cm") }),
  ]);
  assert.deepEqual(p.variations.map((v) => v.stock), [0, 0]);
  assert.deepEqual(p.variations.map((v) => v.extraPrice), [0, 30]);
  assert.equal(p.listPrice, null);
  assert.equal(p.variations[1].variationValue, "Gümüş / 80cm");
});
