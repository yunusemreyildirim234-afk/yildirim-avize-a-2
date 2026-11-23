import test from "node:test";
import assert from "node:assert/strict";
import { onizlemeEskidiMi } from "../lib/trendyol-onizleme-kontrol.ts";

const guncel = { pasifeAlinacak: 2, ezilecek: 5, yeniUrun: 1 };

test("eşit sayaç: eskimedi", () => assert.equal(onizlemeEskidiMi({ pasifeAlinacak: 2, ezilecek: 5, yeniUrun: 1 }, guncel), false));
test("pasife alınacak arttı: eskidi", () => assert.equal(onizlemeEskidiMi({ pasifeAlinacak: 1, ezilecek: 5, yeniUrun: 1 }, guncel), true));
test("ezilecek arttı: eskidi", () => assert.equal(onizlemeEskidiMi({ pasifeAlinacak: 2, ezilecek: 4, yeniUrun: 1 }, guncel), true));
test("yeni ürün arttı: eskidi", () => assert.equal(onizlemeEskidiMi({ pasifeAlinacak: 2, ezilecek: 5, yeniUrun: 0 }, guncel), true));
test("sunucu değerleri küçüldü: eskimedi (fazlası uygulanmaz)", () => assert.equal(onizlemeEskidiMi({ pasifeAlinacak: 9, ezilecek: 9, yeniUrun: 9 }, guncel), false));
test("sayac yok / geçersiz: karşılaştırma yapılmaz", () => {
  for (const v of [undefined, null, "x", 5, []]) assert.equal(onizlemeEskidiMi(v, guncel), false);
});
test("eksik alan: yalnız gönderilen alanlar karşılaştırılır", () => {
  assert.equal(onizlemeEskidiMi({ ezilecek: 5 }, guncel), false);
  assert.equal(onizlemeEskidiMi({ ezilecek: 4 }, guncel), true);
  assert.equal(onizlemeEskidiMi({ ezilecek: "4" }, guncel), false);
  assert.equal(onizlemeEskidiMi({}, guncel), false);
});
