import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { priceCart } = await import("../lib/cart-pricing.ts");
const { ZERO_TOTAL_ERROR, isZeroTotal } = await import("../lib/zero-total.ts");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const line = (price, quantity = 1) => ({ variationId: "v1", productId: "p1", price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null });
const fixed = (amount) => ({ code: "T", discountPercent: 0, productId: null, discountType: "FIXED", discountAmount: amount });

test("350 TL üstü sepette ara toplamı karşılayan TL kupon toplamı 0'a indirir (reddedilecek durum)", () => {
  for (const paymentMethod of ["CREDIT_CARD", "BANK_TRANSFER"]) {
    const p = priceCart({ lines: [line(500)], maxTotalDiscountPct: null, shippingType: "STANDART_KARGO", paymentMethod, coupon: fixed(5000) });
    assert.equal(p.total, 0, paymentMethod);
    assert.equal(isZeroTotal(p.total), true);
  }
});

test("normal sipariş: kuponsuz, küçük kuponlu ve kargo ücretli sepet 0 sayılmaz", () => {
  const base = { maxTotalDiscountPct: null, shippingType: "STANDART_KARGO", paymentMethod: "CREDIT_CARD" };
  assert.equal(isZeroTotal(priceCart({ ...base, lines: [line(500)] }).total), false);
  assert.equal(isZeroTotal(priceCart({ ...base, lines: [line(500)], coupon: fixed(100) }).total), false);
  assert.equal(isZeroTotal(priceCart({ ...base, lines: [line(200)], coupon: fixed(200) }).total), false); // kargo ücretli → toplam > 0
  assert.equal(isZeroTotal(NaN), true);
});

test("sipariş ucu: 0 kontrolü kayıt, havale sınırı, stok düşümü ve kupon rezervasyonundan ÖNCE; mesaj ortak metinle aynı", () => {
  const src = read("app/api/order/route.ts");
  const check = src.indexOf("if (totals.total <= 0)");
  assert.ok(check > 0);
  for (const later of ["bankPendingLimitReached(", "reserveCouponLocked(", "finalizeOrder("]) {
    const at = src.indexOf(later, src.indexOf("const totals = priced;"));
    assert.ok(at === -1 || at > check, later);
  }
  assert.ok(src.slice(check, check + 400).includes(ZERO_TOTAL_ERROR));
  assert.match(src.slice(check, check + 400), /status: 400/);
});

test("fiyat teklifi: zeroTotal alanı döner, sepet sayfası uyarıyı gösterir", () => {
  assert.match(read("app/api/cart/quote/route.ts"), /zeroTotal: lines\.some\(\(l\) => l\.available\) && isZeroTotal\(total\)/);
  const cart = read("app/sepet/page.tsx");
  assert.match(cart, /fresh && quote\.zeroTotal/);
  assert.match(cart, /\{ZERO_TOTAL_ERROR\}/);
});
