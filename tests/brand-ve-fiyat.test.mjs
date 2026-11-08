import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedBrand, feedItemXml } from "../lib/feed.ts";
import { SITE_NAME } from "../lib/site.ts";
import { isPurchasablePrice, priceUnavailableMessage } from "../lib/purchasable.ts";

const base = { id: "p1", title: "Avize", description: "x", category: "Kristal", basePrice: 1000, listPrice: null, imageUrl: "/a.jpg", images: [], variations: [{ extraPrice: 0, stock: 1 }] };
const SITE = "https://www.yildirimavize.com.tr";

test("marka: her üründe (DB markası ne olursa olsun) feed ve JSON-LD aynı sabit: SITE_NAME", () => {
  assert.equal(SITE_NAME, "Yıldırım Avize");
  assert.equal(feedBrand(), SITE_NAME);
  for (const brand of [null, "", "Yalçın Aydınlatma", "yıldırımavize"]) {
    assert.match(feedItemXml({ ...base, brand }, SITE), /<g:brand>Yıldırım Avize<\/g:brand>/);
  }
  // Ürün sayfası JSON-LD'si Product.brand'i değil sabiti kullanır
  const page = readFileSync(new URL("../app/urun/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /brand: \{ "@type": "Brand", name: feedBrand\(\) \}/);
  assert.ok(!/feedBrand\(product\.brand\)/.test(page));
});

test("fiyat: 0, negatif ve sayı olmayan birim fiyat satın alınamaz; pozitif alınır", () => {
  for (const p of [0, -1, -0.01, NaN, Infinity]) assert.equal(isPurchasablePrice(p), false, String(p));
  for (const p of [0.01, 1, 349.9, 12500]) assert.equal(isPurchasablePrice(p), true, String(p));
  assert.match(priceUnavailableMessage("Çırağan 12'li"), /Çırağan 12'li.*fiyat/);
});

test("fiyat kuralı üç sipariş/sepet ucunda da bağlı", () => {
  for (const f of ["../app/api/order/route.ts", "../app/api/cart/quote/route.ts", "../app/api/cart/route.ts"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /isPurchasablePrice\(/, f);
  }
});
