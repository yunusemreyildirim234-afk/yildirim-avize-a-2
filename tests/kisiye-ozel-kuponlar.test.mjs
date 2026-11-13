import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { couponDiscountLabel } from "../lib/coupon-label.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const route = read("../app/api/user/coupons/route.ts");
const quote = read("../app/api/cart/quote/route.ts");
const page = read("../app/sepet/page.tsx");

test("etiket: yüzde ve TL", () => {
  assert.equal(couponDiscountLabel({ discountType: "PERCENT", discountPercent: 5, discountAmount: null }), "%5 indirim");
  assert.equal(couponDiscountLabel({ discountType: "PERCENT", discountPercent: 7.5, discountAmount: null }), "%7,5 indirim");
  assert.equal(couponDiscountLabel({ discountType: "FIXED", discountPercent: 0, discountAmount: 50 }), "50 ₺ indirim");
});

test("misafir 401: oturum yoksa sorgudan önce döner", () => {
  assert.match(route, /status: 401/);
  assert.ok(route.indexOf("status: 401") < route.indexOf("$queryRaw"));
});

test("IDOR: e-posta yalnız oturum kimliğinden gelir, istekten kimlik/e-posta okunmaz", () => {
  assert.match(route, /u\."id" = \$\{userId\}/);
  assert.match(route, /JOIN "User" u ON lower\(c\."userEmail"\) = lower\(u\."email"\)/);
  assert.doesNotMatch(route, /searchParams|req\.json|req\.url|headers\.get/);
});

test("aktif, süresi/limiti dolmamış; hız sınırı; private cache; tek sorgu", () => {
  assert.match(route, /c\."active" = true/);
  assert.match(route, /c\."usedCount" < c\."maxUses"/);
  assert.match(route, /c\."expiresAt" IS NULL OR c\."expiresAt" >= /);
  assert.match(route, /rateLimit\(req, "user-coupons"/);
  assert.match(route, /Cache-Control": "private, max-age=60"/);
  assert.equal((route.match(/prisma\./g) ?? []).length, 1);
});

test("vitrin etiketi ek DB okuması yapmaz: etiket mevcut ladderCtx kuponundan türer", () => {
  assert.match(quote, /showcaseLabel: ladderCtx\?\.coupon \? couponDiscountLabel\(ladderCtx\.coupon\) : null/);
  const label = read("../lib/coupon-label.ts");
  assert.doesNotMatch(label, /prisma|import /);
});

test("sepet: istek yalnız girişli + ürünlü, bir kez; misafirde yok", () => {
  assert.equal((page.match(/fetch\("\/api\/user\/coupons"/g) ?? []).length, 1);
  assert.match(page, /if \(!accountEmail \|\| !hasItems \|\| personalFetched\.current\) return;\s*personalFetched\.current = true;/);
  assert.match(page, /\}, \[accountEmail, hasItems\]\);/);
  assert.match(page, /Size özel/);
  assert.match(page, /quote\.showcaseLabel \|\| "Vitrin kuponu"/);
});
