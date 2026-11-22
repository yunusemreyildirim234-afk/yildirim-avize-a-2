import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { buildProductShare, cleanShareUrl, isShareAbortError } = await import("../lib/product-share.ts");

const SAMPLE_ID = "3f9a1c2e-5b7d-4e1a-9c3f-0a1b2c3d4e5f";

test("cleanShareUrl: sorgu ve hash'i temizler, kanonik ürün yolunu korur, bozuk adreste SITE_URL'e düşer", () => {
  const product = { id: SAMPLE_ID, title: "Kristal Avize 6 Lı (TAM MONTAJLIDIR.)" };

  assert.equal(
    cleanShareUrl("https://www.yildirimavize.com.tr/urun/eski-ad-3f9a1c2e?utm_source=ig&fbclid=123#yorumlar", product),
    "https://www.yildirimavize.com.tr/urun/kristal-avize-6-li-3f9a1c2e"
  );
  assert.equal(
    cleanShareUrl("http://localhost:3000/urun/kristal-avize-6-li-3f9a1c2e?ref=test", product),
    "http://localhost:3000/urun/kristal-avize-6-li-3f9a1c2e"
  );
  assert.equal(
    cleanShareUrl(null, product, "https://www.yildirimavize.com.tr/"),
    "https://www.yildirimavize.com.tr/urun/kristal-avize-6-li-3f9a1c2e"
  );
  assert.equal(
    cleanShareUrl("javascript:alert(1)", product, "https://www.yildirimavize.com.tr"),
    "https://www.yildirimavize.com.tr/urun/kristal-avize-6-li-3f9a1c2e"
  );
});

test("buildProductShare: başlık, kısa metin, temiz URL ve sosyal paylaşım bağlantılarını üretir", () => {
  const share = buildProductShare({
    id: SAMPLE_ID,
    title: "Kontes Gold Avize (TAM MONTAJLIDIR.)",
    category: "Kristal",
    price: 4250,
    url: "https://www.yildirimavize.com.tr/urun/kontes-gold-avize-3f9a1c2e?utm=1#top",
  });

  assert.equal(share.title, "Kontes Gold Avize");
  assert.equal(share.url, "https://www.yildirimavize.com.tr/urun/kontes-gold-avize-3f9a1c2e");
  assert.ok(share.text.includes("Kontes Gold Avize"));
  assert.ok(share.text.includes("4.250,00 ₺"));
  assert.ok(share.text.includes("Yıldırım Avize"));

  assert.ok(share.links.whatsapp.startsWith("https://wa.me/?text="));
  assert.ok(decodeURIComponent(share.links.whatsapp).includes(share.url));
  assert.ok(share.links.facebook.startsWith("https://www.facebook.com/sharer/sharer.php?u="));
  assert.ok(decodeURIComponent(share.links.facebook).includes(share.url));
  assert.ok(share.links.x.startsWith("https://x.com/intent/tweet?"));
  assert.ok(decodeURIComponent(share.links.x).includes(share.url));
  assert.ok(share.links.email.startsWith("mailto:?subject="));
  assert.ok(decodeURIComponent(share.links.email).includes(share.url));
});

test("buildProductShare: fiyat yoksa kategori veya mağaza adıyla kısa bilgi üretir", () => {
  const noPriceWithCat = buildProductShare({
    id: SAMPLE_ID,
    title: "Modern Sarkıt",
    category: "Modern",
    price: null,
  });
  assert.equal(noPriceWithCat.text, "Modern Sarkıt (Modern) | Yıldırım Avize");

  const noPriceNoCat = buildProductShare({
    id: SAMPLE_ID,
    title: "Özel Tasarım Avize",
    category: "",
    price: 0,
  });
  assert.equal(noPriceNoCat.text, "Özel Tasarım Avize | Yıldırım Avize");
});

test("isShareAbortError: yalnızca AbortError için true döner", () => {
  const abortErr = new Error("Share canceled");
  abortErr.name = "AbortError";
  assert.equal(isShareAbortError(abortErr), true);
  assert.equal(isShareAbortError({ name: "AbortError" }), true);
  assert.equal(isShareAbortError(new TypeError("Failed")), false);
  assert.equal(isShareAbortError({ name: "NotAllowedError" }), false);
  assert.equal(isShareAbortError(null), false);
  assert.equal(isShareAbortError("AbortError"), false);
});

test("ProductShareButton ve ProductDetailClient: erişilebilirlik, Web Share + fallback menü ve tema kuralları", () => {
  const btnSrc = readFileSync(new URL("../components/ProductShareButton.tsx", import.meta.url), "utf8");
  const detailSrc = readFileSync(new URL("../components/ProductDetailClient.tsx", import.meta.url), "utf8");

  assert.match(btnSrc, /aria-label="Ürünü paylaş"/);
  assert.match(btnSrc, /title="Paylaş"/);
  assert.match(btnSrc, /navigator\.share/);
  assert.match(btnSrc, /copyText\(url\)/); // pano + textarea yedeği lib/clipboard.ts'te
  assert.match(btnSrc, /Bağlantıyı Kopyala/);
  assert.match(btnSrc, /Kopyalandı/);
  assert.match(btnSrc, /WhatsApp/);
  assert.match(btnSrc, /Facebook/);
  assert.match(btnSrc, /E-posta/);
  assert.match(btnSrc, /Escape/);
  assert.equal(/\b(stone|sky)-/.test(btnSrc), false, "stone/sky renkleri kullanılmamalı");

  // Ürün detay başlık satırında FavoriteButton'ın hemen sağında ve stoksuz üründe de görünür
  const favIdx = detailSrc.indexOf("<FavoriteButton");
  const shareIdx = detailSrc.indexOf("<ProductShareButton");
  assert.ok(favIdx > 0 && shareIdx > favIdx, "Paylaş butonu favori kalbinin hemen sağında olmalı");
});
