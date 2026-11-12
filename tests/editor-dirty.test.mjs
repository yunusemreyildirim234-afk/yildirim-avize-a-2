import test from "node:test";
import assert from "node:assert/strict";
import { editorStateOf, stockSaveBody } from "../lib/editor-dirty.ts";
import { planStockWrite } from "../lib/stock-edit.ts";

const product = (o = {}) => ({
  title: "Avize",
  basePrice: 1000,
  modelCode: "M1",
  ebat: null,
  imageUrl: "/a.webp",
  images: ["/a.webp", "/b.webp"],
  isFeatured: false,
  isBestSeller: true,
  variations: [
    { id: "v1", stock: 5, extraPrice: 0, images: ["/k1.webp"] },
    { id: "v2", stock: 2, extraPrice: 150, images: [] },
  ],
  ...o,
});

test("editorStateOf: ürün form karşılığına çevrilir; görsel yoksa kapak tek görsel olur", () => {
  const s = editorStateOf(product());
  assert.deepEqual(s.info, { title: "Avize", basePrice: "1000", modelCode: "M1", ebat: "", isFeatured: false, isBestSeller: true });
  assert.deepEqual(s.images, ["/a.webp", "/b.webp"]);
  assert.deepEqual(s.vars, { v1: { stock: "5", extraPrice: "0" }, v2: { stock: "2", extraPrice: "150" } });
  assert.deepEqual(s.varImages, { v1: ["/k1.webp"], v2: [] });
  assert.deepEqual(s.order, ["v1", "v2"]);
  assert.deepEqual(editorStateOf(product({ images: [], imageUrl: "/kapak.webp" })).images, ["/kapak.webp"]);
});

test("stok kaydı: prevStock formun açıldığı andaki tabandan gider", () => {
  const base = editorStateOf(product()).vars.v1;
  assert.deepEqual(stockSaveBody("v1", base, { stock: "8", extraPrice: "20" }), { variationId: "v1", stock: 8, prevStock: 5, extraPrice: 20 });
});

test("stok ezme koruması: arada sipariş stoğu düşürdüyse eski form değeri yazılamaz", () => {
  // Form 5 ile açıldı; yönetici yalnızca ek fiyatı değiştirdi (stok alanı hâlâ 5). Arada sipariş geldi: veritabanı 3.
  const base = editorStateOf(product()).vars.v1;
  const form = { stock: "5", extraPrice: "20" };
  const body = stockSaveBody("v1", base, form);
  // Sunucu kuralı: form değeri tabanla aynı → stok HİÇ yazılmaz (rezervasyon korunur).
  assert.deepEqual(planStockWrite(body.stock, body.prevStock), { kind: "SKIP" });

  // Taban yerine yenilenmiş canlı değer (3) gönderilseydi sunucu 3 → 5 yazardı; bu test o geri dönüşü yakalar.
  const live = editorStateOf(product({ variations: [{ id: "v1", stock: 3, extraPrice: 0 }] })).vars.v1;
  assert.deepEqual(planStockWrite(Number(form.stock), Number(live.stock)), { kind: "CAS", expected: 3, next: 5 });
  assert.notEqual(body.prevStock, Number(live.stock));
});

test("stok ezme koruması: yönetici stoğu değiştirdiyse yazım tabana koşullanır (veritabanı farklıysa sunucu reddeder)", () => {
  const base = editorStateOf(product()).vars.v1;
  const body = stockSaveBody("v1", base, { stock: "9", extraPrice: "0" });
  assert.deepEqual(planStockWrite(body.stock, body.prevStock), { kind: "CAS", expected: 5, next: 9 });
});
