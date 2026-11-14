import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("sitemap ürün sorgusu 1 saat ve storefront etiketiyle önbelleklenir; hata önbelleğe girmez", () => {
  assert.match(s, /unstable_cache\(/);
  assert.match(s, /revalidate: 3600, tags: \["storefront"\]/);
  // catch önbellekli fonksiyonun dışında (çağrı tarafında) olmalı
  const body = s.slice(s.indexOf("const getSitemapProducts"), s.indexOf("const GALLERY_PAGE"));
  assert.doesNotMatch(body, /\.catch\(/);
  assert.match(s, /getSitemapProducts\(\)[\s\S]*\.catch\(\(\) => \[\]\)/);
});

test("sitemap içeriği aynı: ürün adresi, lastModified ve sabit sayfalar korunur", () => {
  assert.match(s, /url: `\$\{SITE_URL\}\/urun\/\$\{p\.id\}`/);
  assert.match(s, /lastModified: p\.updatedAt/);
  assert.match(s, /STATIC_PAGES/);
});
