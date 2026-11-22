import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const s = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("sitemap ürün sorgusu 1 saat ve storefront etiketiyle önbelleklenir; hata önbelleğe girmez", () => {
  assert.match(s, /unstable_cache\(/);
  assert.match(s, /revalidate: 3600, tags: \["storefront"\]/);
  // catch önbellekli fonksiyonun dışında (çağrı tarafında) olmalı
  const body = s.slice(s.indexOf("const getSitemapProducts"), s.indexOf("const GALLERY_PAGE"));
  assert.doesNotMatch(body, /\.catch\(/);
  assert.match(s, /getSitemapProducts\(\)[\s\S]*\.catch\(\(\) => \[\]\)/);
});

// Davranış testi: sahte veritabanı (canlı DB'ye bağlanılmaz; önbellek geçişlidir)
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const ROWS = [
  { id: "3f2a9c1e-1111-4222-8333-444455556666", title: "Kristal Salon Avizesi 6'lı", updatedAt: new Date("2026-11-01T10:00:00Z") },
  { id: "aabbccdd-1111-4222-8333-444455556666", title: "Modern Led Avize", updatedAt: new Date("2026-11-02T10:00:00Z") },
  { id: "deadbeef-1111-4222-8333-444455556666", title: "", updatedAt: new Date("2026-11-03T10:00:00Z") },
];
globalThis.__fakePrisma = {
  product: { findMany: async () => ROWS, groupBy: async () => [], count: async () => 0 },
  siteConfig: { findUnique: async () => null },
  review: { count: async () => 0, findMany: async () => [] },
  customerPhoto: { count: async () => 0 },
  $queryRaw: async () => [],
};
const sitemap = (await import("../app/sitemap.ts")).default;
const productUrls = async () => (await sitemap()).map((e) => e.url).filter((u) => u.includes("/urun/"));

test("sitemap içeriği: ürün adresleri /urun/<slug>-<8 hex>, tam uuid yok; lastModified korunur; sabit sayfalar var", async () => {
  const entries = await sitemap();
  const urls = await productUrls();
  assert.equal(urls.length, 3);
  const [a, b] = urls;
  assert.match(a, /\/urun\/[a-z0-9-]+-3f2a9c1e$/);
  assert.match(b, /\/urun\/[a-z0-9-]+-aabbccdd$/);
  assert.ok(a.includes("kristal-salon-avizesi"));
  assert.doesNotMatch(a, UUID_RE);
  assert.doesNotMatch(b, UUID_RE);
  assert.equal(entries.find((e) => e.url === a).lastModified.toISOString(), "2026-11-01T10:00:00.000Z");
  assert.ok(entries.some((e) => e.url.endsWith("/iletisim")));
});

test("başlığı boş ürün eski uuid adresine düşer", async () => {
  const urls = await productUrls();
  assert.ok(urls.some((u) => u.endsWith("/urun/deadbeef-1111-4222-8333-444455556666")));
});
