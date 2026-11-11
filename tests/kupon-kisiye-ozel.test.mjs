import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COUPON_PERSONAL_ERROR, personalCouponError } from "../lib/coupon-personal.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("A1: kişiye özel kupon — misafir, eşleşmeyen hesap, eşleşen hesap, herkese açık kupon", () => {
  assert.equal(COUPON_PERSONAL_ERROR, "Bu kupon için ilgili hesapla giriş yapmanız gerekir");
  assert.equal(personalCouponError("ayse@x.com", null), COUPON_PERSONAL_ERROR, "misafir");
  assert.equal(personalCouponError("ayse@x.com", ""), COUPON_PERSONAL_ERROR, "boş hesap e-postası");
  assert.equal(personalCouponError("ayse@x.com", "mehmet@x.com"), COUPON_PERSONAL_ERROR, "eşleşmeyen hesap");
  assert.equal(personalCouponError("ayse@x.com", "Ayse@X.com "), null, "eşleşen hesap (büyük/küçük harf, boşluk)");
  assert.equal(personalCouponError(null, null), null, "herkese açık, misafir");
  assert.equal(personalCouponError("", "mehmet@x.com"), null, "herkese açık, hesaplı");
});

test("A1: teklif = sipariş — iki uç da hesap e-postasını accountEmail olarak verir, form e-postasını değil", () => {
  const quote = read("app/api/cart/quote/route.ts");
  const order = read("app/api/order/route.ts");
  const single = read("app/api/coupon/route.ts");
  assert.match(quote, /accountEmail: sessionEmail/);
  assert.match(order, /accountEmail,/);
  assert.match(order, /email: accountEmail \?\? String\(email\)\.toLowerCase\(\)/);
  assert.match(single, /accountEmail: sessionUser\?\.email \?\? null/);
  // teklif ve tek kupon ucu aynı metni olduğu gibi döndürür; sepet arayüzü genel hata değilse metni gösterir
  assert.match(quote, /COUPON_PERSONAL_ERROR \? COUPON_PERSONAL_ERROR : COUPON_GENERIC_ERROR/);
  assert.match(single, /result\.error === COUPON_PERSONAL_ERROR/);
  assert.match(read("lib/coupons.ts"), /personalCouponError\(coupon\.userEmail, opts\.accountEmail\)/);
});
