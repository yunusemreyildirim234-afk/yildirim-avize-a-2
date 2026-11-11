import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// "@/..." takma adı için çözümleyici (üretimde Next yapar)
const root = new URL("../", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(s, c, n) { return s.startsWith("@/") ? n(${JSON.stringify(root)} + s.slice(2) + ".ts", c) : n(s, c); }`),
  import.meta.url
);
const { priceCart } = await import("../lib/cart-pricing.ts");

const HOME = "STANDART_KARGO";
const PICKUP = "BEYOGLU_MAGAZA_TESLIM";
const CC = "CREDIT_CARD";
const BANK = "BANK_TRANSFER";
const pct10 = { code: "TEST10", discountPercent: 10, productId: null };
const line = (price, quantity) => ({ variationId: "v1", productId: "p1", price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);

// Bağımsız referans: havale indirimi = round((ürün − kupon − mağaza) × %5), kargo hariç
function expected(price, qty, coupon, pay, ship) {
  const items = price * qty;
  const shipping = ship === PICKUP || items >= 350 ? 0 : 100;
  const c = coupon ? Math.round((items * coupon.discountPercent) / 100) : 0;
  const p = ship === PICKUP ? Math.round(items * 0.03) : 0;
  const bank = pay === BANK ? Math.round(Math.max(0, items - c - p) * 0.05) : 0;
  return { shipping, c, p, bank, total: items + shipping - c - p - bank };
}

const PRICES = [10, 150, 309, 349, 350, 449];

test("priceCart = bağımsız referans: tüm fiyat/adet/kupon/ödeme/teslimat kombinasyonları", () => {
  for (const price of PRICES) for (const qty of [1, 2]) for (const coupon of [null, pct10]) for (const pay of [CC, BANK]) for (const ship of [HOME, PICKUP]) {
    const r = priceCart({ lines: [line(price, qty)], shippingType: ship, paymentMethod: pay, coupon });
    const e = expected(price, qty, coupon, pay, ship);
    const id = `${price}x${qty} ${coupon ? "kupon" : "kuponsuz"} ${pay} ${ship}`;
    near(r.total, e.total, `toplam ${id}`);
    near(r.shipping, e.shipping, `kargo ${id}`);
    near(r.bankDiscount, e.bank, `havale ${id}`);
    near(r.couponDiscount, e.c, `kupon ${id}`);
    near(r.pickupDiscount, e.p, `mağaza ${id}`);
  }
});

test("örnekler: 309 ₺ havale adrese (kargo %5'e girmez), 449 ₺ eskisiyle aynı, 349/350 sınırı", () => {
  const t = (price, pay, ship) => priceCart({ lines: [line(price, 1)], shippingType: ship, paymentMethod: pay }).total;
  assert.equal(t(309, BANK, HOME), 394); // 309 − 15 (309×%5=15,45 → 15) + 100 kargo; eskisi 389
  assert.equal(t(309, CC, HOME), 409);
  assert.equal(t(309, BANK, PICKUP), 285); // 309 − 9 (mağaza) − 15 (havale, 300×%5): kargo yok, değişmez
  assert.equal(t(449, BANK, HOME), 427); // kargo ücretsiz: değişmez
  assert.equal(t(449, BANK, PICKUP), 449 - 13 - Math.round((449 - 13) * 0.05));
  assert.equal(t(349, BANK, HOME), 349 + 100 - 17);
  assert.equal(t(350, BANK, HOME), 350 - 18);
  assert.equal(t(349, CC, HOME), 449);
  assert.equal(t(350, CC, HOME), 350);
});

test("kargo havale indirimi tabanında değil: kargo 100 ₺ iken indirim yalnızca ürün tutarına bağlı", () => {
  const a = priceCart({ lines: [line(200, 1)], shippingType: HOME, paymentMethod: BANK });
  assert.equal(a.shipping, 100);
  assert.equal(a.bankDiscount, 10); // 200 × %5; eskisi 15 (300 × %5)
});

test("toplam indirim üst sınırı (maxTotalDiscountPct) korunur, kargo sınırdan etkilenmez", () => {
  for (const cap of [3, 5, 8]) {
    const r = priceCart({ lines: [line(309, 1)], shippingType: HOME, paymentMethod: BANK, maxTotalDiscountPct: cap });
    assert.equal(r.shipping, 100);
    const discount = r.couponDiscount + r.pickupDiscount + r.bankDiscount;
    assert.ok(discount <= (309 * cap) / 100 + 1e-9, `cap ${cap}: ${discount}`);
    near(r.total, 309 + 100 - discount, `cap ${cap} toplam`);
  }
  // sınır yeterliyse kısılmaz
  assert.equal(priceCart({ lines: [line(309, 1)], shippingType: HOME, paymentMethod: BANK, maxTotalDiscountPct: 10 }).bankDiscount, 15);
});

test("adet kademesi ve ücretsiz kargo eşiği davranışı değişmedi", () => {
  const tiers = [{ minQty: 2, type: "PERCENT", value: 10 }];
  const l = { ...line(200, 2), tiers }; // 2 × 180 = 360 ≥ 350: kargo ücretsiz
  const r = priceCart({ lines: [l], shippingType: HOME, paymentMethod: BANK });
  assert.equal(r.itemsTotal, 360);
  assert.equal(r.shipping, 0);
  assert.equal(r.bankDiscount, 18);
  const one = priceCart({ lines: [{ ...line(200, 1), tiers }], shippingType: HOME, paymentMethod: BANK });
  assert.equal(one.shipping, 100); // adet 1: kademe yok, 200 < 350
});

test("eski lib/pricing.ts computeTotals da aynı kural", async () => {
  const { computeTotals } = await import("../lib/pricing.ts");
  assert.equal(computeTotals({ itemsTotal: 309, shippingType: HOME, paymentMethod: BANK }).total, 394);
  assert.equal(computeTotals({ itemsTotal: 449, shippingType: HOME, paymentMethod: BANK }).total, 427);
  assert.equal(computeTotals({ itemsTotal: 309, shippingType: PICKUP, paymentMethod: BANK }).total, 285);
});
