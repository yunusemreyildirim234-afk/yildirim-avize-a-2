import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_alias-hooks.mjs", import.meta.url);
const { priceCart } = await import("../lib/cart-pricing.ts");
const { priceLadder } = await import("../lib/price-ladder.ts");

const HOME = "STANDART_KARGO", PICKUP = "BEYOGLU_MAGAZA_TESLIM", CC = "CREDIT_CARD", BANK = "BANK_TRANSFER";
const COUPON = { code: "TEST10", discountPercent: 10, productId: null };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
const main = (id, qty) => ({ variationId: `m-${id}`, productId: id, price: 1000, quantity: qty, tiers: [], couponAllowed: false, pickupPct: 0, transferPct: 0 });
const bulb = (rules, qty, extra = {}) => ({ variationId: "vc", productId: "comp", price: 99, quantity: qty, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null, complementOf: rules, ...extra });
const pct = (mainProductId, value) => ({ mainProductId, type: "PERCENT", value });

// Ödemedeki gerçek hesap: sepetin tamamı priceCart'tan geçer; tamamlayıcı satırının birim payı (indirimsiz ana ürün satırları düşülür)
function real(lines, shippingType, paymentMethod, coupon, cap) {
  const r = priceCart({ lines, shippingType, paymentMethod, coupon, maxTotalDiscountPct: cap });
  const mainSum = lines.filter((l) => l.productId !== "comp").reduce((s, l) => s + l.price * l.quantity, 0);
  const b = lines.find((l) => l.productId === "comp");
  return (r.total - r.shipping - mainSum) / b.quantity;
}

function cards(lines, cap, withCoupon) {
  const priced = priceCart({ lines, shippingType: HOME, paymentMethod: CC, maxTotalDiscountPct: cap });
  const pl = priced.lines.find((l) => l.productId === "comp");
  const coupon = withCoupon ? COUPON : null;
  const steps = priceLadder({ basePrice: 99 }, { coupon, maxTotalDiscountPct: cap }, 99, { quantity: pl.quantity, tiers: [] }, pl.bundles?.length ? { rules: pl.complementOf, bundles: pl.bundles, lineQuantity: pl.quantity } : null);
  return { steps, pl };
}

function assertCardsMatchPayment(lines, cap, withCoupon, id) {
  const { steps } = cards(lines, cap, withCoupon);
  const hasCouponStep = steps.some((s) => s.key === "coupon");
  const c = hasCouponStep ? COUPON : null;
  for (const s of steps) {
    const exp = s.key === "coupon" ? real(lines, HOME, CC, COUPON, cap) : s.key === "bank" ? real(lines, HOME, BANK, c, cap) : real(lines, PICKUP, BANK, c, cap);
    near(s.price, exp, `${id} ${s.key}`);
  }
  return steps;
}

test("tek ana ürün, 1 adet: kartlar 89,10 ₺ birim üzerinden ödemedeki hesapla aynı", () => {
  const lines = [main("a", 1), bulb([pct("a", 10)], 1)];
  for (const withCoupon of [false, true]) {
    const steps = assertCardsMatchPayment(lines, null, withCoupon, `tek ${withCoupon}`);
    assert.ok(steps.every((s) => s.price < 89.1 + 1e-9), "kart fiyatları indirimli birimden başlar");
  }
  const before = priceLadder({ basePrice: 99 }, { coupon: null, maxTotalDiscountPct: null }, 99, { quantity: 1, tiers: [] }).find((s) => s.key === "bank").price;
  const after = cards(lines, null, false).steps.find((s) => s.key === "bank").price;
  assert.ok(after < before, `havale kartı ${before} → ${after}`);
});

test("iki ana ürün aynı indirimli fiyat, 3 adet: tek parça gibi, kartlar ödemeyle aynı", () => {
  const lines = [main("a", 2), main("b", 1), bulb([pct("a", 10), pct("b", 10)], 3)];
  for (const withCoupon of [false, true]) assertCardsMatchPayment(lines, null, withCoupon, `iki ana ${withCoupon}`);
});

test("üst sınır (maxTotalDiscountPct): kartlar tavan dahil ödemeyle aynı", () => {
  const lines = [main("a", 2), bulb([pct("a", 10)], 2)];
  for (const cap of [5, 10, 12, 20]) for (const withCoupon of [false, true]) assertCardsMatchPayment(lines, cap, withCoupon, `tavan ${cap} ${withCoupon}`);
});

test("karışık adet (5 ampulün 3'ü indirimli) ve farklı indirimli fiyatlar: kartlar normal birimden, eski davranış", () => {
  const mixed = [main("a", 2), main("b", 1), bulb([pct("a", 10), pct("b", 10)], 5)];
  const diff = [main("a", 1), main("b", 1), bulb([pct("a", 10), pct("b", 12)], 2)];
  for (const lines of [mixed, diff]) for (const withCoupon of [false, true]) {
    const { steps, pl } = cards(lines, null, withCoupon);
    assert.ok(pl.bundles?.length);
    const old = priceLadder({ basePrice: 99 }, { coupon: withCoupon ? COUPON : null, maxTotalDiscountPct: null }, 99, { quantity: pl.quantity, tiers: [] });
    assert.deepEqual(steps, old);
  }
});

test("tamamlayıcı yok: complement verilmese de boş olsa da sonuç aynı", () => {
  const ctx = { coupon: COUPON, maxTotalDiscountPct: 10 };
  const base = priceLadder({ basePrice: 99 }, ctx, 99, { quantity: 2, tiers: [] });
  assert.deepEqual(priceLadder({ basePrice: 99 }, ctx, 99, { quantity: 2, tiers: [] }, null), base);
  assert.deepEqual(priceLadder({ basePrice: 99 }, ctx, 99, { quantity: 2, tiers: [] }, { rules: [], bundles: [], lineQuantity: 2 }), base);
});
