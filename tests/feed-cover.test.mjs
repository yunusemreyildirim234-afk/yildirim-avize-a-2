import test from "node:test";
import assert from "node:assert/strict";
import { feedItemXml } from "../lib/feed.ts";

const base = { id: "p1", title: "Avize", description: "x", category: "Kristal", basePrice: 1000, listPrice: null, imageUrl: "/api/product-images/aaa", images: [], brand: null };
const SITE = "https://www.yildirimavize.com.tr";
const link = (xml) => xml.match(/<g:image_link>(.*?)<\/g:image_link>/)[1];

test("feed image_link: genel fotoğrafın ilki; genel yoksa ilk rengin fotoğrafı", () => {
  const withColor = feedItemXml({ ...base, variations: [{ extraPrice: 0, stock: 0, images: ["/k.jpg"] }, { extraPrice: 50, stock: 4, images: ["/m.jpg", "/m2.jpg"] }] }, SITE);
  assert.equal(link(withColor), `${SITE}/api/product-images/aaa`);
  assert.match(withColor, /<g:additional_image_link>https:\/\/www\.yildirimavize\.com\.tr\/m\.jpg/);
  const noGeneral = feedItemXml({ ...base, imageUrl: null, images: [], variations: [{ extraPrice: 0, stock: 0, images: ["/k.jpg"] }, { extraPrice: 50, stock: 4, images: ["/m.jpg"] }] }, SITE);
  assert.equal(link(noGeneral), `${SITE}/k.jpg`);
  const noColorImg = feedItemXml({ ...base, variations: [{ extraPrice: 0, stock: 2, images: [] }] }, SITE);
  assert.equal(link(noColorImg), `${SITE}/api/product-images/aaa`);
  const legacy = feedItemXml({ ...base, variations: [{ extraPrice: 0, stock: 2 }] }, SITE);
  assert.equal(link(legacy), `${SITE}/api/product-images/aaa`);
});
test("feed: yüklenen görseller mutlak https adrese çevrilir", () => {
  const xml = feedItemXml({ ...base, variations: [{ extraPrice: 0, stock: 1 }] }, SITE);
  assert.ok(!/<g:image_link>\//.test(xml));
});

import { readFileSync } from "node:fs";
test("robots.txt: /api/ kapalı ama yüklenen ürün görselleri taranabilir (Merchant/Googlebot-Image)", () => {
  const src = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
  assert.match(src, /allow: \["\/", "\/api\/product-images\/"\]/);
  assert.match(src, /disallow: \[[^\]]*"\/api\/"/);
});
