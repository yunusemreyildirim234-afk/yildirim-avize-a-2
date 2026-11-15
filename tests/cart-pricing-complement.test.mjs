import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

const root = new URL("../", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(s, c, n) { return s.startsWith("@/") ? n(${JSON.stringify(root)} + s.slice(2) + ".ts", c) : n(s, c); }`),
  import.meta.url
);
const { priceCart } = await import("../lib/cart-pricing.ts");
// Tamamlayıcı eklemesinden ÖNCEKİ hesabın dondurulmuş kopyası (karşılaştırma ölçütü)
const oracle = await import("./_cart-pricing-oracle.ts");
const { totalSavings, referenceUnit } = await import("../lib/cart-savings.ts");
const { breakdownOf } = await import("../lib/order-display.ts");

const HOME = "STANDART_KARGO";
const PICKUP = "BEYOGLU_MAGAZA_TESLIM";
const L = (productId, price, quantity, over = {}) => ({ variationId: `v-${productId}-${over.vid ?? 0}`, productId, price, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null, ...over });
const pct = (mainProductId, value) => ({ mainProductId, type: "PERCENT", value });
const fix = (mainProductId, value) => ({ mainProductId, type: "FIXED", value });
const r2 = (x) => Math.round(x * 100) / 100;

// ---------- BOZULMAMA: complementOf yokken sonuç eski hesapla birebir aynı ----------
const tier5 = [{ minQty: 2, type: "PERCENT", value: 5 }, { minQty: 5, type: "FIXED", value: 20 }];
const baskets = [
  [L("a", 28999, 1)],
  [L("a", 100, 1)],
  [L("a", 349.99, 1), L("b", 0.01, 1)],
  [L("a", 120, 3, { tiers: tier5 }), L("a", 130, 2, { tiers: tier5, vid: 1 }), L("b", 80, 2)],
  [L("a", 500, 2, { couponAllowed: false }), L("b", 200, 1, { pickupPct: 0 }), L("c", 150, 4, { transferPct: 10, tiers: tier5 })],
  [L("a", 1000, 1, { pickupPct: 7, transferPct: 0 }), L("b", 333.33, 3, { transferPct: 2 })],
  [L("a", 90, 7, { tiers: tier5 })],
];
const coupons = [
  null,
  { code: "X", discountPercent: 10, productId: null },
  { code: "Y", discountPercent: 0, productId: null, discountType: "FIXED", discountAmount: 75 },
  { code: "Z", discountPercent: 20, productId: "a", minCartTotal: 300 },
];
const caps = [undefined, null, 0, 10, 25, 60];
const ships = [HOME, PICKUP];
const pays = ["CREDIT_CARD", "BANK_TRANSFER"];
const strip = (p) => ({ ...p, lines: p.lines.map(({ complementOf, ...rest }) => rest) });

test("bozulmama: complementOf yok / boş / ana ürünü sepette olmayan / geçersiz kural → eski hesapla BİREBİR aynı (bundle anahtarı yok)", () => {
  let n = 0;
  for (const basket of baskets)
    for (const coupon of coupons)
      for (const cap of caps)
        for (const shippingType of ships)
          for (const paymentMethod of pays) {
            const opts = { shippingType, paymentMethod, coupon, maxTotalDiscountPct: cap };
            const expected = oracle.priceCart({ ...opts, lines: basket });
            const variants = [
              basket,
              basket.map((l) => ({ ...l, complementOf: [] })),
              basket.map((l) => ({ ...l, complementOf: [pct("yok", 50), fix("yok2", 5)] })), // ana ürün sepette yok
              basket.map((l) => ({ ...l, complementOf: [pct("a", 100), fix("a", -3), { mainProductId: "a", type: "X", value: 5 }] })), // geçersiz kurallar
            ];
            for (const lines of variants) {
              const got = priceCart({ ...opts, lines });
              assert.equal(got.lines.some((l) => "bundle" in l), false);
              assert.deepEqual(strip(got), strip(expected));
              n++;
            }
          }
  assert.ok(n > 1000);
});

test("bozulmama: bilinen değerler", () => {
  const p = priceCart({ lines: [L("a", 28999, 1)], shippingType: HOME, paymentMethod: "BANK_TRANSFER" });
  assert.equal(p.itemsTotal, 28999);
  assert.equal(p.shipping, 0);
  assert.equal(p.bankDiscount, Math.round(28999 * 0.05));
  const q = priceCart({ lines: [L("a", 100, 1)], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(q.shipping, 100);
  assert.equal(q.total, 200);
});

// ---------- ETKİLEŞİM ----------
const bulbRules = [pct("main", 10)];
const mainAndBulb = (bulbOver = {}) => [L("main", 1000, 1), L("bulb", 100, 6, { complementOf: bulbRules, ...bulbOver })];

test("ana ürün sepette: tamamlayıcının TÜM adetleri indirimli; bundle doğru", () => {
  const p = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  const bulb = p.lines[1];
  assert.equal(bulb.unitPrice, 90);
  assert.equal(bulb.lineTotal, 540);
  assert.deepEqual(bulb.bundle, { mainProductId: "main", unitDiscount: 10, total: 60 });
  assert.equal(p.lines[0].bundle, undefined);
  assert.equal(p.itemsTotal, 1540);
});

test("ana ürün sepette yok: indirim yok", () => {
  const p = priceCart({ lines: [L("bulb", 100, 6, { complementOf: bulbRules })], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(p.lines[0].unitPrice, 100);
  assert.equal(p.lines[0].bundle, undefined);
});

test("kademe + birlikte alma yığılır (%5 + %10 ≈ %14,5)", () => {
  const tiers = [{ minQty: 2, type: "PERCENT", value: 5 }];
  const p = priceCart({ lines: mainAndBulb({ tiers }), shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(p.lines[0].unitPrice, 1000);
  assert.equal(p.lines[1].unitPrice, r2(95 * 0.9)); // 85.5
  assert.equal(p.lines[1].bundle.unitDiscount, 9.5);
  assert.equal(p.lines[1].bundle.total, 57);
});

test("tamamlayıcının renkleri: her satır aynı birim indirimi alır", () => {
  const lines = [L("main", 1000, 1), L("bulb", 100, 2, { complementOf: bulbRules, vid: 1 }), L("bulb", 100, 3, { complementOf: bulbRules, vid: 2 })];
  const p = priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.deepEqual(p.lines.slice(1).map((l) => l.unitPrice), [90, 90]);
  assert.equal(p.itemsTotal, 1000 + 450);
});

test("kupon tabanı indirimli tutardır; couponAllowed=false ve minimum sepet kuralı aynen işler", () => {
  const coupon = { code: "X", discountPercent: 10, productId: null };
  const p = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "CREDIT_CARD", coupon });
  assert.equal(p.couponDiscount, 154); // (1000 + 540) × %10; indirimsiz olsaydı 160
  const np = priceCart({ lines: mainAndBulb({ couponAllowed: false }), shippingType: HOME, paymentMethod: "CREDIT_CARD", coupon });
  assert.equal(np.couponDiscount, 100); // yalnız ana ürün
  const minCart = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "CREDIT_CARD", coupon: { ...coupon, minCartTotal: 1600 } });
  assert.ok(minCart.couponError); // indirimli toplam 1540 < 1600
});

test("ücretsiz kargo eşiği (350) indirimli toplamla kıyaslanır", () => {
  const lines = [L("main", 100, 1), L("bulb", 260, 1, { complementOf: [fix("main", 20)] })];
  const p = priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(p.itemsTotal, 340);
  assert.equal(p.shipping, 100); // indirimsiz 360 olurdu: kargo çıkar (karar 2)
  const exact = priceCart({ lines: [L("main", 100, 1), L("bulb", 270, 1, { complementOf: [fix("main", 20)] })], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(exact.itemsTotal, 350);
  assert.equal(exact.shipping, 0); // tam 350 ücretsiz
});

test("Havale ve mağaza indirimi indirimli tutar üzerinden", () => {
  const bank = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "BANK_TRANSFER" });
  assert.equal(bank.bankDiscount, Math.round(1540 * 0.05));
  const pickup = priceCart({ lines: mainAndBulb(), shippingType: PICKUP, paymentMethod: "CREDIT_CARD" });
  assert.equal(pickup.pickupDiscount, Math.round(1540 * 0.03));
  const mixed = priceCart({ lines: mainAndBulb({ transferPct: 0 }), shippingType: HOME, paymentMethod: "BANK_TRANSFER" });
  assert.equal(mixed.bankDiscount, Math.round(1000 * 0.05)); // ana ürün %5, tamamlayıcı 0
});

test("üst sınır: birlikte alma kademe gibi kısılmaz, kupon/mağaza/Havale payını tüketir", () => {
  const coupon = { code: "X", discountPercent: 10, productId: null };
  const lines = [L("main", 1000, 1), L("bulb", 100, 6, { complementOf: [pct("main", 20)] })];
  const capped = priceCart({ lines, shippingType: HOME, paymentMethod: "BANK_TRANSFER", coupon, maxTotalDiscountPct: 20 });
  assert.equal(capped.lines[1].unitPrice, 80); // kısılmadı
  assert.equal(capped.lines[1].lineTotal, 480);
  assert.ok(capped.lines[1].capInfo);
  assert.equal(capped.lines[1].capInfo.remainingPct, 0); // kalan pay tükendi
  const free = priceCart({ lines, shippingType: HOME, paymentMethod: "BANK_TRANSFER", coupon });
  assert.ok(capped.couponDiscount + capped.bankDiscount < free.couponDiscount + free.bankDiscount);
  assert.ok(capped.total > free.total);
});

test("cart-savings değişmezi birlikte alma varken de tutar", () => {
  for (const [shippingType, paymentMethod, coupon] of [[HOME, "CREDIT_CARD", null], [HOME, "BANK_TRANSFER", { code: "X", discountPercent: 10, productId: null }], [PICKUP, "CREDIT_CARD", null]]) {
    const lines = mainAndBulb();
    const items = lines.map((l) => ({ ...l, listPrice: l.price }));
    const priced = priceCart({ lines, shippingType, paymentMethod, coupon });
    const sav = totalSavings(items, priced.total, priced.shipping);
    const listTotal = items.reduce((s, i) => s + referenceUnit(i) * i.quantity, 0);
    const expected = listTotal - priced.itemsTotal + priced.couponDiscount + priced.pickupDiscount + priced.bankDiscount;
    assert.ok(Math.abs(sav - expected) < 0.011, `${sav} != ${expected}`);
    assert.ok(listTotal - priced.itemsTotal >= 60 - 1e-9); // 60 ₺ birlikte alma kazancı sayılır
  }
});

test("breakdownOf(saklı unitPrice) sepet toplamı ve kargo ile eşleşir", () => {
  for (const lines of [mainAndBulb(), [L("main", 100, 1), L("bulb", 260, 1, { complementOf: [fix("main", 20)] })]]) {
    const priced = priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD" });
    const b = breakdownOf(priced.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })), HOME, priced.total);
    assert.equal(b.itemsSum, priced.itemsTotal);
    assert.equal(b.shipping, priced.shipping);
    assert.equal(b.total, priced.total);
  }
});

test("birden fazla ana ürün: en büyük indirim tek kez; birim indirim ≥ fiyat ise bağ yok", () => {
  const lines = [L("m1", 500, 1), L("m2", 500, 1), L("bulb", 100, 2, { complementOf: [pct("m1", 10), fix("m2", 30)] })];
  const p = priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(p.lines[2].unitPrice, 70);
  assert.equal(p.lines[2].bundle.mainProductId, "m2");
  const over = priceCart({ lines: [L("m1", 500, 1), L("bulb", 100, 1, { complementOf: [fix("m1", 100)] })], shippingType: HOME, paymentMethod: "CREDIT_CARD" });
  assert.equal(over.lines[1].unitPrice, 100);
  assert.equal(over.lines[1].bundle, undefined);
});
