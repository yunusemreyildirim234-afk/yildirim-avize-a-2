import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("vitrin bağlamı: önbellekli sürüm 'storefront' etiketli, sepet/sipariş yolu önbelleksiz sürümü kullanır", () => {
  const s = src("lib/showcase.ts");
  assert.match(s, /unstable_cache\(readLadderContext, \["sf-ladder-context"\], \{ revalidate: 60, tags: \["storefront"\] \}\)/);
  assert.match(s, /export const getLadderContextFresh = cache\(readLadderContext\)/);
  assert.match(src("app/api/cart/quote/route.ts"), /getLadderContextFresh/);
  assert.doesNotMatch(src("app/api/cart/quote/route.ts"), /getLadderContext\b(?!Fresh)/);
  assert.doesNotMatch(src("app/api/order/route.ts"), /getLadderContext/);
  assert.doesNotMatch(src("lib/cart-pricing.ts"), /getLadderContext|showcase/);
});

test("vitrin bağlamı: tek SiteConfig select'i", () => {
  const s = src("lib/showcase.ts");
  assert.match(s, /select: \{ showcaseCouponId: true, maxTotalDiscountPct: true \}/);
});
