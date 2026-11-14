import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Çok Satanlar sayfası 300 sn önbellekli; yönetici ucu önbelleksiz kalır", () => {
  const p = src("lib/products.ts");
  assert.match(p, /BEST_SELLERS_PAGE_CACHE_SECONDS = 300/);
  assert.match(p, /getBestSellersCached[\s\S]*\["storefront"\]/);
  assert.match(src("app/kategori/[slug]/page.tsx"), /getBestSellersCached\(48\)/);
  assert.match(src("app/api/admin/product/bulk/route.ts"), /await getBestSellers\(48\)/);
});
