import test from "node:test";
import assert from "node:assert/strict";
import { bulbNoteFor } from "../lib/bulb-note.ts";

test("başlıkta ampul hediye → gift", () => {
  assert.equal(bulbNoteFor("Kontes 12 Li Yemek Masası Eskitme (TAM MONTAJLIDIR.) ( Led Ampuller Hediye)"), "gift");
  assert.equal(bulbNoteFor("1 Li Kontes Aplik Eskitme Şapkalı (LED AMPUL HEDİYE)"), "gift");
  assert.equal(bulbNoteFor("Banker Masa Lambası Eskitme Renk Kasa ,yeşil Camlı ( Orjinal Üründür) ( Led Ampul Hediye )"), "gift");
});

test("ampulle ilgisiz hediye veya sıradan ürün → not-included", () => {
  assert.equal(bulbNoteFor("10 Adet 2 cm çapında Şeffaf Boncuk Kristal Avize Taşı (metal halka hediye)"), "not-included");
  assert.equal(bulbNoteFor("Kristal Avize 6 Lı Modern"), "not-included");
});

test("Aksesuar kategorisi → none", () => {
  assert.equal(bulbNoteFor("Kristal Avize Taşı", "Aksesuar"), "none");
  assert.equal(bulbNoteFor("Kristal Avize Taşı", "AKSESUAR"), "none");
  assert.equal(bulbNoteFor("Kristal Avize 6 Lı Modern", "Kristal"), "not-included");
});

test("M4: aksesuar kategorisi tanınır (büyük/küçük harf ve boşluk farkıyla); diğerleri ve boş değer aksesuar değildir", async () => {
  const { isAccessoryCategory } = await import("../lib/bulb-note.ts");
  for (const c of ["Aksesuar", "AKSESUAR", "aksesuar"]) assert.equal(isAccessoryCategory(c), true, c);
  for (const c of ["Kristal", "Aksesuarlı Avize", "", null, undefined]) assert.equal(isAccessoryCategory(c), false, String(c));
});

test("M4: SSS ampul cümlesi; aksesuarda Ölçü & Tavan Uyumu kutusu ve Benzer Avize Modelleri başlığı koşullu", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const faq = read("../components/FaqSection.tsx");
  assert.ok(faq.includes("Ampuller, ürün sayfasında 'LED ampul hediye' yazan ürünlerde hediye olarak gönderilir; diğer ürünlerde ürüne dahil değildir."));
  assert.ok(!faq.includes("ampuller ürünlerimize dahil değildir"));
  assert.match(read("../components/ProductDetailClient.tsx"), /\{!isAccessoryCategory\(product\.category\) && \(\s*<li[^>]*>\s*<span aria-hidden="true">📏<\/span>/);
  assert.match(read("../app/urun/[id]/page.tsx"), /isAccessoryCategory\(product\.category\) \? "sr-only"/);
});
