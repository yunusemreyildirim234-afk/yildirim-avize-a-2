import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseVariations, parseImageUrls, uploadedIdsOf, pickDefaultVariation, coverImageOf, colorKey, uploadedImageId } from "../lib/variation-input.ts";

const row = (o = {}) => ({ name: "Gold", stock: 10, extraPrice: 0, images: [], ...o });
const UUID = "123e4567-e89b-42d3-a456-426614174000";

test("en az bir renk", () => {
  assert.equal(parseVariations([]).ok, false);
  assert.equal(parseVariations(undefined).ok, false);
});
test("boş / yalnız boşluk renk adı reddedilir", () => {
  assert.equal(parseVariations([row({ name: "" })]).ok, false);
  assert.equal(parseVariations([row({ name: "   " })]).ok, false);
  assert.equal(parseVariations([row({ name: 5 })]).ok, false);
});
test("yinelenen renk: trim + büyük/küçük harf (Türkçe) duyarsız", () => {
  assert.equal(parseVariations([row({ name: "Gold" }), row({ name: " gold " })]).ok, false);
  assert.equal(parseVariations([row({ name: "IŞIK" }), row({ name: "ışık" })]).ok, false);
  assert.equal(parseVariations([row({ name: "Altın  Sarısı" }), row({ name: "altın sarısı" })]).ok, false);
  assert.equal(parseVariations([row({ name: "Gold" }), row({ name: "Krom" })]).ok, true);
  assert.equal(colorKey(" İstanbul "), "istanbul");
});
test("renk adı uzunluk sınırı", () => {
  assert.equal(parseVariations([row({ name: "a".repeat(60) })]).ok, true);
  assert.equal(parseVariations([row({ name: "a".repeat(61) })]).ok, false);
});
test("stok: tam sayı 0-99999", () => {
  for (const stock of [0, 1, 99999, "25"]) assert.equal(parseVariations([row({ stock })]).ok, true, String(stock));
  for (const stock of [-1, 100000, 1.5, "", "abc", null, undefined, NaN, Infinity]) assert.equal(parseVariations([row({ stock })]).ok, false, String(stock));
});
test("fiyat farkı: varsayılan 0, makul sınır", () => {
  const ok = parseVariations([row({ extraPrice: undefined })]);
  assert.equal(ok.ok && ok.value[0].extraPrice, 0);
  assert.equal(parseVariations([row({ extraPrice: 250.5 })]).ok, true);
  for (const extraPrice of [-1, 1_000_001, "x", Infinity]) assert.equal(parseVariations([row({ extraPrice })]).ok, false, String(extraPrice));
});
test("renk başına en fazla 5 fotoğraf; renk sayısı sınırı", () => {
  const imgs = (n) => Array.from({ length: n }, (_, i) => `https://cdn.example.com/${i}.jpg`);
  assert.equal(parseVariations([row({ images: imgs(5) })]).ok, true);
  assert.equal(parseVariations([row({ images: imgs(6) })]).ok, false);
  assert.equal(parseVariations(Array.from({ length: 31 }, (_, i) => row({ name: `c${i}` }))).ok, false);
});
test("ürün fotoğrafı: en fazla 10, yalnız https veya /yol, tekil", () => {
  const imgs = (n) => Array.from({ length: n }, (_, i) => `/api/product-images/${UUID.slice(0, -2)}${String(i).padStart(2, "0")}`);
  assert.equal(parseImageUrls(imgs(10), 10, "x").ok, true);
  assert.equal(parseImageUrls(imgs(11), 10, "x").ok, false);
  for (const bad of ["http://a.com/x.jpg", "javascript:alert(1)", "//evil.com/x.jpg", "data:image/png;base64,AAA", "", "a b"]) assert.equal(parseImageUrls([bad], 10, "x").ok, false, bad);
  const dup = parseImageUrls(["/a.jpg", "/a.jpg"], 10, "x");
  assert.deepEqual(dup.ok && dup.value, ["/a.jpg"]);
  assert.equal(parseImageUrls("x", 10, "x").ok, false);
});
test("yüklenmiş görsel kimliği çıkarma", () => {
  assert.equal(uploadedImageId(`/api/product-images/${UUID}`), UUID);
  assert.equal(uploadedImageId(`/api/product-images/${UUID}/../x`), null);
  assert.equal(uploadedImageId("https://cdn.dsmcdn.com/a.jpg"), null);
  assert.deepEqual(uploadedIdsOf([`/api/product-images/${UUID}`, "https://x.com/a.jpg"], [`/api/product-images/${UUID}`]), [UUID]);
});
test("varsayılan varyasyon = ilk stoklu; yoksa ilki; kapak buna göre", () => {
  const vs = [{ stock: 0, images: ["/k.jpg"] }, { stock: 3, images: ["/m.jpg"] }, { stock: 9, images: [] }];
  assert.equal(pickDefaultVariation(vs), vs[1]);
  assert.equal(pickDefaultVariation([{ stock: 0 }, { stock: 0 }]).stock, 0);
  assert.equal(pickDefaultVariation([]), null);
  assert.equal(coverImageOf({ imageUrl: "/p.jpg", variations: vs }), "/m.jpg");
  assert.equal(coverImageOf({ imageUrl: "/p.jpg", variations: [{ stock: 2, images: [] }] }), "/p.jpg");
  assert.equal(coverImageOf({ imageUrl: null, variations: [] }), null);
});
test("Trendyol eşitlemesi elle eklenen renk/fotoğraflara dokunmaz (kaynak denetimi)", () => {
  const plan = readFileSync(new URL("../lib/trendyol-plan.ts", import.meta.url), "utf8");
  const sync = readFileSync(new URL("../lib/trendyol-sync.ts", import.meta.url), "utf8");
  const varFields = plan.match(/VARIATION_FIELDS[^=]*=\s*\[([\s\S]*?)\];/)[1];
  assert.ok(!/images|position/.test(varFields), "VARIATION_FIELDS images/position içermemeli");
  assert.ok(!/productVariation\.(delete|deleteMany)|productImage/.test(sync + plan), "eşitleme varyasyon/görsel silmemeli");
  assert.ok(!/variations\.[a-z]*\([^)]*images/.test(plan), "varyasyon görseli plan tarafından yazılmamalı");
  // yalnızca barkodu olan (Trendyol kaynaklı) varyasyonlar eşleşir; elle eklenenler (barkodsuz) kalkan sayımına bile girmez
  assert.ok(/ex\.variations\.filter\(\(v\) => v\.barcode && !incCodes\.has\(v\.barcode\)\)/.test(plan));
  assert.ok(/for \(const v of ex\.variations\) if \(v\.barcode\) byBarcode/.test(plan));
});
