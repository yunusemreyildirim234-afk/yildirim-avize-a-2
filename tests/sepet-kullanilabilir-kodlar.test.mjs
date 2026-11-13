import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");

test("bölüm yalnızca listelenecek kod varken çizilir", () => {
  assert.match(src, /\{codeRows\.length > 0 && \(\s*<section aria-label="Kullanabileceğiniz kodlar"/);
});

test("Uygula, elle girişle aynı applyCouponCode akışını kullanır", () => {
  assert.match(src, /return applyCouponCode\(couponInput\)/);
  assert.match(src, /void applyCouponCode\(row\.code\)/);
  assert.equal((src.match(/fetch\("\/api\/coupon"/g) ?? []).length, 2); // yalnız mevcut iki çağrı (yenileme + uygulama)
});

test("uygulanmış kod 'Uygulandı' görünür, tekrar uygula düğmesi yok", () => {
  assert.match(src, /appliedCoupon\?\.code === row\.code \?[\s\S]*?Uygulandı[\s\S]*?: \(\s*<button/);
});

test("düğme en az 44 px", () => {
  assert.match(src, /min-h-11 min-w-11[^"]*"\s*>\s*Uygula/);
});
