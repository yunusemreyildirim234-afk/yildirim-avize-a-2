import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { computeTotals, FREE_SHIPPING_THRESHOLD, SHIPPING_COST, SHIPPING_TYPES } = await import("../lib/pricing.ts");
const { priceCart } = await import("../lib/cart-pricing.ts");

const HOME = SHIPPING_TYPES.HOME;
const PICKUP = SHIPPING_TYPES.PICKUP;
const line = (price, quantity = 1) => ({ variationId: "v1", productId: "p1", price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null });

test("eşik 350 TL, kargo 129 TL (sabitler)", () => {
  assert.equal(FREE_SHIPPING_THRESHOLD, 350);
  assert.equal(SHIPPING_COST, 129);
});

test("eve teslim, kart: 349,99 → kargo 129; 350,00 → 0; 350,01 → 0 (computeTotals)", () => {
  assert.equal(computeTotals({ itemsTotal: 349.99, shippingType: HOME, paymentMethod: "CREDIT_CARD" }).shipping, 129);
  assert.equal(computeTotals({ itemsTotal: 350, shippingType: HOME, paymentMethod: "CREDIT_CARD" }).shipping, 0);
  assert.equal(computeTotals({ itemsTotal: 350.01, shippingType: HOME, paymentMethod: "CREDIT_CARD" }).shipping, 0);
});

test("priceCart aynı sınırı uygular ve toplam kargoyu içerir", () => {
  const a = priceCart({ lines: [line(349.99)], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(a.shipping, 129);
  assert.equal(a.total, 478.99);
  const b = priceCart({ lines: [line(350)], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(b.shipping, 0);
  assert.equal(b.total, 350);
  const c = priceCart({ lines: [line(350.01)], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(c.shipping, 0);
  assert.equal(c.total, 350.01);
});

test("eşik ürün tutarına bakar, adetle de aşılır (175 × 2 = 350 → ücretsiz; 174,99 × 2 = 349,98 → ücretli)", () => {
  assert.equal(priceCart({ lines: [line(175, 2)], shippingType: HOME, paymentMethod: "CREDIT_CARD" }).shipping, 0);
  assert.equal(priceCart({ lines: [line(174.99, 2)], shippingType: HOME, paymentMethod: "CREDIT_CARD" }).shipping, 129);
});

test("mağazadan teslimde kargo her tutarda 0 (eşiğin altında da)", () => {
  for (const p of [1, 349.99, 350, 350.01]) {
    assert.equal(computeTotals({ itemsTotal: p, shippingType: PICKUP, paymentMethod: "CREDIT_CARD" }).shipping, 0, String(p));
    assert.equal(priceCart({ lines: [line(p)], shippingType: PICKUP, paymentMethod: "CREDIT_CARD" }).shipping, 0, String(p));
  }
});

test("kupon/indirim eşiği değiştirmez: kargo kupon öncesi ürün tutarına göre (350 TL, 100 TL kuponla bile ücretsiz)", () => {
  const r = priceCart({ lines: [line(350)], shippingType: HOME, paymentMethod: "CREDIT_CARD", coupon: { code: "T", discountType: "FIXED", discountPercent: 0, discountAmount: 100 } });
  assert.equal(r.shipping, 0);
  assert.equal(r.total, 250);
});
