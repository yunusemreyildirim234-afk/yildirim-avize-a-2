import test from "node:test";
import assert from "node:assert/strict";
import { truncateAtWord, productSeoTitle, productMetaDescription, offerExtras, gtin13Of } from "../lib/product-seo.ts";
import { displayTitle } from "../lib/title-display.ts";

const T = "Kontes 12 Li Yemek Masası Eskitme (TAM MONTAJLIDIR.) ( Led Ampuller Hediye)";

test("kesilen başlık sayı ya da en çok 2 karakterlik kelimeyle bitmez", () => {
  assert.equal(truncateAtWord("Modern Kristal Salon Avizesi 18 Kollu", 29), "Modern Kristal Salon Avizesi");
  assert.equal(truncateAtWord("Kristal Avize Modern Tasarım", 20), "Kristal Avize Modern"); // normal
  assert.equal(truncateAtWord("Kristal Avize 12", 40), "Kristal Avize 12"); // kısa başlık kesilmez
  assert.equal(truncateAtWord("Salon Avizesi Led Ve Modern", 17), "Salon Avizesi Led"); // 3 karakter kalır
  assert.equal(truncateAtWord("Salon Avizesi Ve Modern", 16), "Salon Avizesi"); // 2 karakterlik "Ve" atılır
});

test("kelime sınırında kesme: kelime ortasında bitmez, açık parantez atılır", () => {
  assert.equal(truncateAtWord("Kristal Avize Modern Tasarım", 20), "Kristal Avize Modern");
  assert.equal(truncateAtWord("kısa", 20), "kısa");
  assert.equal(truncateAtWord("Kontes 12 Li Yemek (Led Ampuller", 25), "Kontes 12 Li Yemek");
  assert.ok(productSeoTitle(displayTitle(T).title).length <= 40);
});

test("meta açıklama ≤160, fiyat ve montaj/indirim cümleleri", () => {
  const d = productMetaDescription({ cleanTitle: displayTitle(T).title, price: 8999, category: "Kristal", pickupDiscountPct: null });
  assert.ok(d.length <= 160, d);
  assert.match(d, /8\.999 ₺/);
  assert.match(d, /Montajlı gönderilir; 350 TL üzeri kargo ücretsiz, Şişhane mağazadan teslimde %3 indirim\.$/);
  const long = productMetaDescription({ cleanTitle: "Çok ".repeat(60) + "uzun", price: 1, category: "Modern" });
  assert.ok(long.length <= 160);
});

test("Aksesuar'da 'Montajlı' yok; mağaza indirimi 0 ise indirim cümlesi yok", () => {
  assert.doesNotMatch(productMetaDescription({ cleanTitle: "Avize Taşı", price: 50, category: "Aksesuar" }), /Montajlı/);
  const d = productMetaDescription({ cleanTitle: "Avize", price: 5000, category: "Kristal", pickupDiscountPct: 0 });
  assert.doesNotMatch(d, /mağazadan teslimde/);
  assert.match(d, /350 TL üzeri kargo ücretsiz\.$/);
  assert.match(productMetaDescription({ cleanTitle: "Avize", price: 5000, category: "Kristal", pickupDiscountPct: 7 }), /%7 indirim/);
});

test("Offer ekleri: kargo eşiği, iade 14 gün, +30 gün, gtin13", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const hi = offerExtras({ price: 350, siteUrl: "https://x.tr", now });
  assert.equal(hi.shippingDetails.shippingRate.value, 0);
  assert.equal(offerExtras({ price: 349, siteUrl: "https://x.tr", now }).shippingDetails.shippingRate.value, 129);
  assert.equal(hi.hasMerchantReturnPolicy.merchantReturnDays, 14);
  assert.equal(hi.hasMerchantReturnPolicy.merchantReturnLink, "https://x.tr/iptal-iade-cayma");
  assert.equal(hi.priceValidUntil, "2026-01-31");
  assert.deepEqual(gtin13Of("4006381333931"), { gtin13: "4006381333931" });
  assert.deepEqual(gtin13Of("4006381333932"), {});
  assert.deepEqual(gtin13Of(null), {});
});

test("ürün sayfası JSON-LD: Offer ekleri ve gtin13 bağlı", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../app/urun/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(s, /\.\.\.offerExtras\(\{ price: offer\.price, siteUrl: SITE_URL \}\)/);
  assert.match(s, /\.\.\.gtin13Of\(offer\.variation\?\.barcode\)/);
  assert.match(s, /truncateAtWord\(product\.description \|\| product\.title, JSONLD_DESCRIPTION_MAX\)/);
});
