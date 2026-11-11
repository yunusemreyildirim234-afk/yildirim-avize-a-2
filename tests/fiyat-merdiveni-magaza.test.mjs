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
const { priceLadder } = await import("../lib/price-ladder.ts");

const HOME = "STANDART_KARGO";
const PICKUP = "BEYOGLU_MAGAZA_TESLIM";
const CC = "CREDIT_CARD";
const BANK = "BANK_TRANSFER";
const pct10 = { code: "TEST10", discountPercent: 10, productId: null };
const line = (price, quantity) => ({ variationId: "v1", productId: "p1", price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);

const PRICES = [10, 150, 309, 349, 350, 449];

test("merdiven + kargo = priceCart toplamı (adrese), merdiven sonu = toplam (mağazadan); mağaza satırı HER ZAMAN var; adet 1 ve 2", () => {
  for (const price of PRICES) for (const qty of [1, 2]) for (const withCoupon of [false, true]) {
    const coupon = withCoupon ? pct10 : null;
    const ctx = { coupon, maxTotalDiscountPct: null };
    const steps = priceLadder({ basePrice: price }, ctx, price, { quantity: qty, tiers: [] });
    const homeBank = priceCart({ lines: [line(price, qty)], shippingType: HOME, paymentMethod: BANK, coupon });
    const pickupBank = priceCart({ lines: [line(price, qty)], shippingType: PICKUP, paymentMethod: BANK, coupon });
    const id = `${price}x${qty} ${withCoupon ? "kupon" : "kuponsuz"}`;
    const pickup = steps.find((s) => s.key === "pickup");
    assert.ok(pickup, `mağaza satırı ${id}`);
    assert.equal(steps[steps.length - 1].key, "pickup", `mağaza son satır ${id}`);
    const homeSteps = steps.filter((s) => s.key !== "pickup");
    const homeLast = homeSteps.length ? homeSteps[homeSteps.length - 1].price : price;
    near(homeLast * qty + homeBank.shipping, homeBank.total, `merdiven (adrese) + kargo ${id}`);
    near(pickup.price * qty, pickupBank.total, `merdiven mağaza ${id}`);
  }
});

test("mağaza satırı daha ucuz değilse ipucu 'Kargo ücreti yok, Beyoğlu mağazadan teslimde'; ucuzsa kısa ipucu", () => {
  const ctx = { coupon: null, maxTotalDiscountPct: null };
  const cheap = priceLadder({ basePrice: 309 }, ctx).find((s) => s.key === "pickup");
  assert.equal(cheap.hint, "Beyoğlu mağazadan teslimde");
  const same = priceLadder({ basePrice: 10 }, ctx).find((s) => s.key === "pickup"); // %3 × 10 ₺ yuvarlanınca 0
  assert.equal(same.hint, "Kargo ücreti yok, Beyoğlu mağazadan teslimde");
  assert.ok(same.price <= 10);
  assert.equal(priceLadder({ basePrice: 309, pickupDiscountPct: 0 }, ctx).find((s) => s.key === "pickup"), undefined);
});

test("havale satırı etiketi '%5' içerir (indirim yalnızca ürün tutarından hesaplandığı için doğru)", () => {
  const bank = priceLadder({ basePrice: 309 }, { coupon: null, maxTotalDiscountPct: null }).find((s) => s.key === "bank");
  assert.equal(bank.label, "+ Havale/EFT ile (%5)");
  assert.equal(bank.short, "Havale/EFT %5");
  assert.equal(bank.price, 294); // 309 − 15; + 100 kargo = 394
});
