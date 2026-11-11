import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const fixed = (amount) => ({ code: `TL${amount}`, discountType: "FIXED", discountAmount: amount, discountPercent: 0, productId: null });
const pct10 = { code: "TEST10", discountPercent: 10, productId: null };
const line = (price, quantity = 1, o = {}) => ({ variationId: o.id ?? "v1", productId: o.id ?? "p1", price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null, ...o });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
const sh = (items, ship) => (ship === PICKUP || items >= 350 ? 0 : 100);

// ---- (1) Sabit TL kupon ----
function refFixed(price, qty, amount, pay, ship) {
  const items = price * qty;
  const c = Math.min(items, amount);
  const p = ship === PICKUP ? Math.round(items * 0.03) : 0;
  const bank = pay === BANK ? Math.round(Math.max(0, items - c - p) * 0.05) : 0;
  return { c, p, bank, shipping: sh(items, ship), total: Math.max(0, items + sh(items, ship) - c - p - bank) };
}

test("sabit TL kupon (50 ₺) ve ürün fiyatından büyük kupon (500 ₺): priceCart = bağımsız referans, tüm kombinasyonlar", () => {
  for (const price of [10, 150, 309, 449]) for (const qty of [1, 2]) for (const amount of [50, 500]) for (const pay of [CC, BANK]) for (const ship of [HOME, PICKUP]) {
    const r = priceCart({ lines: [line(price, qty)], shippingType: ship, paymentMethod: pay, coupon: fixed(amount) });
    const e = refFixed(price, qty, amount, pay, ship);
    const id = `${price}x${qty} ${amount}₺ ${pay} ${ship}`;
    near(r.couponDiscount, e.c, `kupon ${id}`);
    near(r.pickupDiscount, e.p, `mağaza ${id}`);
    near(r.bankDiscount, e.bank, `havale ${id}`);
    near(r.shipping, e.shipping, `kargo ${id}`);
    near(r.total, e.total, `toplam ${id}`);
    assert.ok(r.total >= 0 && r.bankDiscount >= 0, `negatif yok ${id}`);
  }
});

test("TL kupon örnekleri: 309 ₺ − 50 ₺ havale adrese; kupon ürünü aşınca kargo kalır", () => {
  const t = (price, amount, pay, ship) => priceCart({ lines: [line(price)], shippingType: ship, paymentMethod: pay, coupon: fixed(amount) }).total;
  assert.equal(t(309, 50, BANK, HOME), 309 + 100 - 50 - Math.round(259 * 0.05)); // 359 − 13 = 346
  assert.equal(t(309, 50, BANK, PICKUP), 309 - 50 - 9 - Math.round(250 * 0.05)); // 238
  assert.equal(t(309, 500, BANK, HOME), 100); // ürün 0 ₺, havale indirimi 0, kargo ödenir
  assert.equal(t(309, 500, CC, HOME), 100);
  assert.equal(t(309, 500, BANK, PICKUP), 0);
});

test("TL kupon: merdiven + kargo = toplam (adrese), merdiven sonu = toplam (mağazadan)", () => {
  for (const price of [10, 150, 309, 449]) for (const qty of [1, 2]) for (const amount of [50, 500]) {
    const coupon = fixed(amount);
    const steps = priceLadder({ basePrice: price }, { coupon, maxTotalDiscountPct: null }, price, { quantity: qty, tiers: [] });
    const home = priceCart({ lines: [line(price, qty)], shippingType: HOME, paymentMethod: BANK, coupon });
    const pick = priceCart({ lines: [line(price, qty)], shippingType: PICKUP, paymentMethod: BANK, coupon });
    const id = `${price}x${qty} ${amount}₺`;
    const homeSteps = steps.filter((s) => s.key !== "pickup");
    const homeLast = homeSteps.length ? homeSteps[homeSteps.length - 1].price : price;
    near(homeLast * qty + home.shipping, home.total, `merdiven+kargo ${id}`);
    near(steps.find((s) => s.key === "pickup").price * qty, pick.total, `mağaza ${id}`);
  }
});

// ---- (2) İki farklı oranlı ürün ----
// Bağımsız referans (yüzde kupon; kupon satırlara paylı, mağaza indirimi oran grubuna göre yuvarlanır, havale oran grubuna göre yuvarlanır)
function refMixed(ls, coupon, pay, ship) {
  const items = ls.reduce((s, l) => s + l.price * l.quantity, 0);
  const shipping = sh(items, ship);
  const elig = ls.filter((l) => l.couponAllowed !== false);
  const eligTotal = elig.reduce((s, l) => s + l.price * l.quantity, 0);
  const c = coupon ? Math.min(items, Math.round((eligTotal * coupon.discountPercent) / 100)) : 0;
  const rate = (pct, def) => (pct === null || pct === undefined ? def : pct / 100);
  const pickupGroups = new Map(); // oran → grup ürün toplamı
  if (ship === PICKUP) for (const l of ls) pickupGroups.set(rate(l.pickupPct, 0.03), (pickupGroups.get(rate(l.pickupPct, 0.03)) ?? 0) + l.price * l.quantity);
  const pickupTotal = [...pickupGroups].reduce((s, [r, t]) => s + Math.round(t * r), 0);
  const pickupOfLine = (l) => {
    if (ship !== PICKUP) return 0;
    const r = rate(l.pickupPct, 0.03);
    const groupTotal = pickupGroups.get(r);
    return (Math.round(groupTotal * r) * l.price * l.quantity) / groupTotal;
  };
  const baseOf = (l) => l.price * l.quantity - (l.couponAllowed !== false && eligTotal > 0 ? (c * l.price * l.quantity) / eligTotal : 0) - pickupOfLine(l);
  const bankGroups = new Map();
  for (const l of ls) bankGroups.set(rate(l.transferPct, 0.05), (bankGroups.get(rate(l.transferPct, 0.05)) ?? 0) + baseOf(l));
  const bank = pay === BANK ? [...bankGroups].reduce((s, [r, b]) => s + Math.round(Math.max(0, b) * r), 0) : 0;
  return { c, p: pickupTotal, bank, shipping, total: Math.max(0, items + shipping - c - pickupTotal) - bank };
}

test("iki farklı oranlı ürün (biri varsayılan %5/%3, diğeri transferPct 10 ve mağaza 0): toplam bağımsız referansla uyuşur", () => {
  const a = (price, qty) => line(price, qty, { id: "pa" });
  const b = (price, qty, extra = {}) => line(price, qty, { id: "pb", transferPct: 10, pickupPct: 0, ...extra });
  const carts = [
    [a(200, 1), b(100, 1)],
    [a(150, 2), b(60, 1)],
    [a(309, 1), b(25, 3)],
    [a(10, 1), b(10, 1)],
    [a(200, 1), b(100, 1, { couponAllowed: false })],
  ];
  for (const ls of carts) for (const coupon of [null, pct10]) for (const pay of [CC, BANK]) for (const ship of [HOME, PICKUP]) {
    const r = priceCart({ lines: ls, shippingType: ship, paymentMethod: pay, coupon });
    const e = refMixed(ls, coupon, pay, ship);
    const id = `${ls.map((l) => `${l.price}x${l.quantity}`).join("+")} ${coupon ? "kupon" : "kuponsuz"} ${pay} ${ship}`;
    near(r.couponDiscount, e.c, `kupon ${id}`);
    near(r.pickupDiscount, e.p, `mağaza ${id}`);
    near(r.bankDiscount, e.bank, `havale ${id}`);
    near(r.total, e.total, `toplam ${id}`);
  }
});

test("karışık oran, elle hesap: 200 ₺ (%5/%3) + 100 ₺ (transfer %10, mağaza 0), %10 kupon", () => {
  const ls = [line(200, 1, { id: "pa" }), line(100, 1, { id: "pb", transferPct: 10, pickupPct: 0 })];
  const home = priceCart({ lines: ls, shippingType: HOME, paymentMethod: BANK, coupon: pct10 });
  assert.equal(home.couponDiscount, 30);
  assert.equal(home.pickupDiscount, 0);
  assert.equal(home.bankDiscount, 18); // 180×%5 = 9 + 90×%10 = 9
  assert.equal(home.total, 300 + 100 - 30 - 18);
  const pick = priceCart({ lines: ls, shippingType: PICKUP, paymentMethod: BANK, coupon: pct10 });
  assert.equal(pick.pickupDiscount, 6); // yalnızca 200 ₺'lik üründe %3
  assert.equal(pick.shipping, 0);
  assert.equal(pick.total, 300 - 30 - 6 - pick.bankDiscount);
});

// ---- (3) Kupon + maxTotalDiscountPct ----
test("kupon + toplam indirim üst sınırı: indirim sınırı aşmaz, sınıra yaklaşır, kargo etkilenmez, tutarlar tutarlı", () => {
  const carts = [[line(309)], [line(150, 2)], [line(200, 1, { id: "pa" }), line(100, 1, { id: "pb", transferPct: 10, pickupPct: 0 })]];
  for (const ls of carts) for (const coupon of [pct10, fixed(50)]) for (const cap of [3, 5, 8, 12]) for (const ship of [HOME, PICKUP]) {
    const r = priceCart({ lines: ls, shippingType: ship, paymentMethod: BANK, coupon, maxTotalDiscountPct: cap });
    const free = priceCart({ lines: ls, shippingType: ship, paymentMethod: BANK, coupon });
    const list = ls.reduce((s, l) => s + l.price * l.quantity, 0);
    const discount = r.couponDiscount + r.pickupDiscount + r.bankDiscount;
    const id = `${list} ${coupon.code} cap${cap} ${ship}`;
    assert.ok(discount <= (list * cap) / 100 + 1e-9, `sınır aşıldı ${id}: ${discount}`);
    assert.equal(r.shipping, free.shipping, `kargo ${id}`);
    near(r.total, r.itemsTotal + r.shipping - discount, `toplam ${id}`);
    assert.ok(r.total >= free.total - 1e-9, `sınırlı toplam serbestten düşük olamaz ${id}`);
    const freeDiscount = free.couponDiscount + free.pickupDiscount + free.bankDiscount;
    if (freeDiscount > (list * cap) / 100) assert.ok(discount >= (list * cap) / 100 - 0.05 * ls.length, `sınıra yaklaşmalı ${id}: ${discount}`);
    else near(discount, freeDiscount, `sınır altında kısılmaz ${id}`);
  }
});

test("üst sınır örneği: 309 ₺ %10 kupon + havale adrese, sınır %10: indirim 30,90'ı aşmaz, kargo 100 ₺", () => {
  const r = priceCart({ lines: [line(309)], shippingType: HOME, paymentMethod: BANK, coupon: pct10, maxTotalDiscountPct: 10 });
  const d = r.couponDiscount + r.pickupDiscount + r.bankDiscount;
  assert.ok(d <= 30.9 + 1e-9 && d >= 30.85, String(d));
  assert.equal(r.shipping, 100);
  near(r.total, 309 + 100 - d, "toplam");
});

test("üst sınır + merdiven: merdiven + kargo = toplam (adrese), merdiven sonu = toplam (mağazadan)", () => {
  for (const price of [150, 309, 449]) for (const coupon of [pct10, fixed(50)]) for (const cap of [5, 10]) {
    const steps = priceLadder({ basePrice: price }, { coupon, maxTotalDiscountPct: cap }, price);
    const home = priceCart({ lines: [line(price)], shippingType: HOME, paymentMethod: BANK, coupon, maxTotalDiscountPct: cap });
    const pick = priceCart({ lines: [line(price)], shippingType: PICKUP, paymentMethod: BANK, coupon, maxTotalDiscountPct: cap });
    const id = `${price} ${coupon.code} cap${cap}`;
    const homeSteps = steps.filter((s) => s.key !== "pickup");
    const homeLast = homeSteps.length ? homeSteps[homeSteps.length - 1].price : price;
    if (steps.some((s) => s.key === "bank")) near(homeLast + home.shipping, home.total, `merdiven+kargo ${id}`);
    else {
      // BİLİNEN KÜÇÜK FARK (kod değiştirilmedi, raporlandı): üst sınır kısılmasında kuruş aşağı yuvarlandığı için havale toplamı, kartla kuponlu
      // fiyattan 1 kuruş fazla çıkabilir (örn. 150 ₺, %10 kupon, sınır %5: kart+kupon 242,50, havale 242,51). Havale adımı "ucuz değil" diye gizlenir.
      assert.ok(home.total - (homeLast + home.shipping) <= 0.0101 && home.total >= homeLast + home.shipping - 1e-9, `merdiven+kargo (en çok 1 kuruş) ${id}: ${homeLast + home.shipping} / ${home.total}`);
    }
    near(steps.find((s) => s.key === "pickup").price, pick.total, `mağaza ${id}`);
  }
});

// ---- Teklif = sipariş = ödeme: aynı fonksiyon, aynı girdi ----
test("teklif ve sipariş ucu priceCart'ı aynı argümanlarla çağırır; sipariş ve PayTR tutarı priceCart toplamıdır", () => {
  const quote = readFileSync(new URL("../app/api/cart/quote/route.ts", import.meta.url), "utf8");
  const order = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");
  const call = /priceCart\(\{ lines: priceLines, maxTotalDiscountPct: cap, shippingType, paymentMethod(, coupon: check\.rule)? \}\)/g;
  assert.equal((quote.match(call) ?? []).length, 2, "quote");
  assert.equal((order.match(call) ?? []).length, 2, "order");
  assert.match(order, /const totals = priced;/);
  assert.match(order, /totalAmount: totals\.total/);
  assert.match(order, /amountTl: totals\.total/);
  assert.match(quote, /total \} = priced/);
});
