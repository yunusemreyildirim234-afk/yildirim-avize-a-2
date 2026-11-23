import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

const root = new URL("../", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(s, c, n) { return s.startsWith("@/") ? n(${JSON.stringify(root)} + s.slice(2) + ".ts", c) : n(s, c); }`),
  import.meta.url
);
const { priceCart, splitPricedLine } = await import("../lib/cart-pricing.ts");
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

test("bozulmama: complementOf yok / boş / ana ürünü sepette olmayan / geçersiz kural → eski hesapla BİREBİR aynı (bundles anahtarı yok)", () => {
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
              assert.equal(got.lines.some((l) => "bundles" in l), false);
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
  assert.equal(q.shipping, 129);
  assert.equal(q.total, 229);
});

// ---------- ETKİLEŞİM (sahip kararı: her ana ürün adedi, tamamlayıcıdan 1 adedi KENDİ bağının indirimiyle indirimli yapar) ----------
const bulbRules = [pct("main", 10)];
const mainAndBulb = (bulbOver = {}) => [L("main", 1000, 1), L("bulb", 100, 6, { complementOf: bulbRules, ...bulbOver })];
const run = (lines, over = {}) => priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD", ...over });
// Satır bölme sonrası kalemlerin toplamı sepet satır toplamına (kuruşu kuruşuna) eşit olmalı
const rowsSum = (priced) => r2(priced.lines.flatMap((l) => splitPricedLine(l)).reduce((s, r) => s + r.unitPrice * r.quantity, 0));

test("1 adet tamamlayıcı: indirim o 1 adete; satır bölünmez", () => {
  const p = run([L("main", 1000, 1), L("bulb", 100, 1, { complementOf: bulbRules })]);
  const bulb = p.lines[1];
  assert.equal(bulb.unitPrice, 100);
  assert.equal(bulb.lineTotal, 90);
  assert.deepEqual(bulb.bundles, [{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }]);
  assert.deepEqual(splitPricedLine(bulb).map((r) => [r.quantity, r.unitPrice]), [[1, 90]]);
});

test("2 ve 6 adet: yalnız 1 adet indirimli, kalan adetler normal; toplam doğru", () => {
  const two = run([L("main", 1000, 1), L("bulb", 100, 2, { complementOf: bulbRules })]);
  assert.equal(two.lines[1].lineTotal, 190);
  assert.equal(two.lines[1].bundles[0].total, 10);
  assert.deepEqual(splitPricedLine(two.lines[1]).map((r) => [r.quantity, r.unitPrice, r.bundle ? r.bundle.total : null]), [[1, 90, 10], [1, 100, null]]);
  const six = run(mainAndBulb());
  const bulb = six.lines[1];
  assert.equal(bulb.unitPrice, 100); // normal birim
  assert.equal(bulb.lineTotal, 590); // 90 + 5 × 100
  assert.deepEqual(bulb.bundles, [{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }]);
  assert.equal(six.lines[0].bundles, undefined);
  assert.equal(six.itemsTotal, 1590);
  assert.deepEqual(splitPricedLine(bulb).map((r) => [r.quantity, r.unitPrice]), [[1, 90], [5, 100]]);
  assert.equal(rowsSum(six), six.itemsTotal);
});

test("ana ürün adedi 3: tamamlayıcıdan 3 adet indirimli (her ana adedi 1 hak)", () => {
  const p = run([L("main", 1000, 3), L("bulb", 100, 6, { complementOf: bulbRules })]);
  assert.equal(p.lines[1].lineTotal, 570); // 3 × 90 + 3 × 100
  assert.deepEqual(p.lines[1].bundles, [{ mainProductId: "main", unitDiscount: 10, qty: 3, total: 30 }]);
  assert.equal(p.itemsTotal, 3570);
  assert.deepEqual(splitPricedLine(p.lines[1]).map((r) => [r.quantity, r.unitPrice]), [[3, 90], [3, 100]]);
});

test("ana ürün sepette yok: indirim yok", () => {
  const p = run([L("bulb", 100, 6, { complementOf: bulbRules })]);
  assert.equal(p.lines[0].unitPrice, 100);
  assert.equal(p.lines[0].lineTotal, 600);
  assert.equal(p.lines[0].bundles, undefined);
  assert.deepEqual(splitPricedLine(p.lines[0]), [{ quantity: 6, unitPrice: 100, bundle: null }]);
});

test("yüzde ve TL indirimi 1 adet için", () => {
  const percent = run([L("main", 1000, 1), L("bulb", 100, 4, { complementOf: [pct("main", 25)] })]);
  assert.equal(percent.lines[1].lineTotal, 75 + 300);
  assert.equal(percent.lines[1].bundles[0].total, 25);
  const fixed = run([L("main", 1000, 1), L("bulb", 100, 4, { complementOf: [fix("main", 30)] })]);
  assert.equal(fixed.lines[1].lineTotal, 70 + 300);
  assert.equal(fixed.lines[1].bundles[0].total, 30);
});

test("kuruş yuvarlama: kalem toplamları satır/sepet toplamına eşit", () => {
  for (const [price, qty, rule] of [[33.33, 3, pct("main", 7)], [19.99, 5, pct("main", 12.5)], [0.2, 4, fix("main", 0.07)], [249.9, 2, pct("main", 3.3)], [10, 7, pct("main", 33.33)]]) {
    const p = run([L("main", 1000, 1), L("bulb", price, qty, { complementOf: [rule] })]);
    const bulb = p.lines[1];
    const rows = splitPricedLine(bulb);
    const rowTotal = r2(rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0));
    assert.equal(rowTotal, r2(bulb.lineTotal), `${price} × ${qty}`);
    assert.equal(rows.reduce((s, r) => s + r.quantity, 0), qty);
    assert.equal(rowsSum(p), r2(p.itemsTotal));
    assert.equal(r2(rows[0].unitPrice), r2(price - bulb.bundles[0].unitDiscount));
  }
});

test("kademe + birlikte alma yığılır; indirim yalnız 1 adet (%5 kademe, sonra %10)", () => {
  const tiers = [{ minQty: 2, type: "PERCENT", value: 5 }];
  const p = run(mainAndBulb({ tiers }));
  assert.equal(p.lines[0].unitPrice, 1000);
  assert.equal(p.lines[1].unitPrice, 95); // kademe sonrası normal birim
  assert.equal(p.lines[1].bundles[0].unitDiscount, 9.5);
  assert.equal(p.lines[1].bundles[0].total, 9.5);
  assert.equal(p.lines[1].lineTotal, 560.5); // 85,5 + 5 × 95
  assert.deepEqual(splitPricedLine(p.lines[1]).map((r) => [r.quantity, r.unitPrice]), [[1, 85.5], [5, 95]]);
});

test("tamamlayıcının renkleri: haklar ana ürün adedi kadardır ve satırlar arasında paylaşılır", () => {
  const lines = [L("main", 1000, 1), L("bulb", 100, 2, { complementOf: bulbRules, vid: 1 }), L("bulb", 100, 3, { complementOf: bulbRules, vid: 2 })];
  const p = run(lines);
  assert.deepEqual(p.lines.slice(1).map((l) => l.lineTotal), [190, 300]); // tek hak ilk satırda
  assert.equal(p.itemsTotal, 1000 + 190 + 300);
  const two = run([L("main", 1000, 2), ...lines.slice(1)]);
  assert.deepEqual(two.lines.slice(1).map((l) => l.lineTotal), [180, 300]); // 2 hak ilk satırda biter (ilk satır 2 adet)
});

test("kupon tabanı indirimli tutardır; couponAllowed=false ve minimum sepet kuralı aynen işler", () => {
  const coupon = { code: "X", discountPercent: 10, productId: null };
  const p = run(mainAndBulb(), { coupon });
  assert.equal(p.couponDiscount, 159); // (1000 + 590) × %10; indirimsiz olsaydı 160
  const np = run(mainAndBulb({ couponAllowed: false }), { coupon });
  assert.equal(np.couponDiscount, 100); // yalnız ana ürün
  const minCart = run(mainAndBulb(), { coupon: { ...coupon, minCartTotal: 1600 } });
  assert.ok(minCart.couponError); // indirimli toplam 1590 < 1600
});

test("ücretsiz kargo eşiği (350) indirimli toplamla kıyaslanır", () => {
  const p = run([L("main", 100, 1), L("bulb", 260, 1, { complementOf: [fix("main", 20)] })]);
  assert.equal(p.itemsTotal, 340);
  assert.equal(p.shipping, 129); // indirimsiz 360 olurdu: kargo çıkar (karar 2)
  const exact = run([L("main", 100, 1), L("bulb", 270, 1, { complementOf: [fix("main", 20)] })]);
  assert.equal(exact.itemsTotal, 350);
  assert.equal(exact.shipping, 0); // tam 350 ücretsiz
});

test("Havale ve mağaza indirimi indirimli tutar üzerinden", () => {
  const bank = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "BANK_TRANSFER" });
  assert.equal(bank.bankDiscount, Math.round(1590 * 0.05));
  const pickup = run(mainAndBulb(), { shippingType: PICKUP });
  assert.equal(pickup.pickupDiscount, Math.round(1590 * 0.03));
  const mixed = priceCart({ lines: mainAndBulb({ transferPct: 0 }), shippingType: HOME, paymentMethod: "BANK_TRANSFER" });
  assert.equal(mixed.bankDiscount, Math.round(1000 * 0.05)); // ana ürün %5, tamamlayıcı 0
});

test("üst sınır: birlikte alma kademe gibi kısılmaz, kupon/mağaza/Havale payını tüketir", () => {
  const coupon = { code: "X", discountPercent: 10, productId: null };
  const lines = [L("main", 1000, 1), L("bulb", 100, 1, { complementOf: [pct("main", 20)] })];
  const capped = priceCart({ lines, shippingType: HOME, paymentMethod: "BANK_TRANSFER", coupon, maxTotalDiscountPct: 20 });
  assert.equal(capped.lines[1].lineTotal, 80); // kısılmadı
  assert.ok(capped.lines[1].capInfo);
  assert.equal(capped.lines[1].capInfo.remainingPct, 0); // kalan pay tükendi
  const free = priceCart({ lines, shippingType: HOME, paymentMethod: "BANK_TRANSFER", coupon });
  assert.ok(capped.couponDiscount + capped.bankDiscount < free.couponDiscount + free.bankDiscount);
  assert.ok(capped.total > free.total);
  // çok adette üst sınır satırın gerçek (karma) toplamından hesaplanır; kademe/bağ fiyatı kısılmaz
  const six = priceCart({ lines: mainAndBulb(), shippingType: HOME, paymentMethod: "BANK_TRANSFER", coupon, maxTotalDiscountPct: 5 });
  assert.equal(six.lines[1].lineTotal, 590);
  assert.ok(six.lines[1].capInfo && six.lines[1].capInfo.remainingPct > 0);
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
    assert.ok(listTotal - priced.itemsTotal >= 10 - 1e-9); // 10 ₺ birlikte alma kazancı sayılır (yalnız 1 adet)
  }
});

test("breakdownOf(saklı kalemler: bölünmüş satırlar) sepet toplamı ve kargo ile eşleşir; sipariş = sepet toplamı", () => {
  for (const lines of [mainAndBulb(), [L("main", 100, 1), L("bulb", 260, 1, { complementOf: [fix("main", 20)] })], [L("main", 100, 1), L("bulb", 33.33, 3, { complementOf: [pct("main", 7)] })]]) {
    const priced = priceCart({ lines, shippingType: HOME, paymentMethod: "CREDIT_CARD" });
    const rows = priced.lines.flatMap((l) => splitPricedLine(l));
    const b = breakdownOf(rows.map((r) => ({ unitPrice: r.unitPrice, quantity: r.quantity })), HOME, priced.total);
    assert.equal(r2(b.itemsSum), r2(priced.itemsTotal));
    assert.equal(b.shipping, priced.shipping);
    assert.equal(b.total, priced.total);
  }
});

test("birden fazla ana ürün: her biri kendi indirimiyle 1 hak; birim indirim ≥ fiyat ise bağ yok", () => {
  const lines = [L("m1", 500, 1), L("m2", 500, 1), L("bulb", 100, 2, { complementOf: [pct("m1", 10), fix("m2", 30)] })];
  const p = run(lines);
  assert.equal(p.lines[2].unitPrice, 100);
  assert.equal(p.lines[2].lineTotal, 160); // 70 (m2) + 90 (m1); indirimler toplanıp tek adede yüklenmez
  assert.deepEqual(p.lines[2].bundles.map((g) => [g.mainProductId, g.qty, g.total]), [["m2", 1, 30], ["m1", 1, 10]]); // büyük indirim önce
  const over = run([L("m1", 500, 1), L("bulb", 100, 1, { complementOf: [fix("m1", 100)] })]);
  assert.equal(over.lines[1].unitPrice, 100);
  assert.equal(over.lines[1].bundles, undefined);
});

// ---------- ANA ÜRÜN ADEDİ KURALI: her ana ürün adedi, tamamlayıcıdan 1 adedi KENDİ bağının indirimiyle indirimli yapar ----------
const small = pct("small", 12); // ampul 100 ₺ → 12 ₺ indirim
const big = pct("big", 16); // 16 ₺ indirim
const shape = (p, i) => splitPricedLine(p.lines[i]).map((r) => [r.quantity, r.unitPrice, r.bundle ? r.bundle.mainProductId : null]);
const eqSum = (p) => assert.equal(rowsSum(p), r2(p.itemsTotal));

test("ana adedi kuralı: 1 avize + 1 ampul → 1 indirimli; 1 avize + 2 ampul → 1 indirimli + 1 normal", () => {
  const a = run([L("small", 1000, 1), L("bulb", 100, 1, { complementOf: [small] })]);
  assert.deepEqual(shape(a, 1), [[1, 88, "small"]]);
  const b = run([L("small", 1000, 1), L("bulb", 100, 2, { complementOf: [small] })]);
  assert.deepEqual(shape(b, 1), [[1, 88, "small"], [1, 100, null]]);
  eqSum(a); eqSum(b);
});

test("ana adedi kuralı: 2 avize + 2 ampul → 2 indirimli; 2 avize (farklı) + 1 ampul → 1 indirimli, büyük indirim", () => {
  const a = run([L("small", 1000, 2), L("bulb", 100, 2, { complementOf: [small] })]);
  assert.deepEqual(shape(a, 1), [[2, 88, "small"]]);
  assert.equal(a.lines[1].lineTotal, 176);
  const b = run([L("small", 1000, 1), L("big", 1000, 1), L("bulb", 100, 1, { complementOf: [small, big] })]);
  assert.deepEqual(shape(b, 2), [[1, 84, "big"]]);
  assert.equal(b.lines[2].lineTotal, 84);
  const c = run([L("small", 1000, 2), L("bulb", 100, 1, { complementOf: [small] })]); // aynı avizeden 2, 1 ampul: hak fazla, boşa gider
  assert.deepEqual(shape(c, 1), [[1, 88, "small"]]);
  eqSum(a); eqSum(b); eqSum(c);
});

test("ana adedi kuralı: 10 küçük (12) + 1 büyük (16) + 11 ampul → 1×16 + 10×12", () => {
  const p = run([L("small", 1000, 10), L("big", 1000, 1), L("bulb", 100, 11, { complementOf: [small, big] })]);
  assert.deepEqual(shape(p, 2), [[1, 84, "big"], [10, 88, "small"]]);
  assert.equal(p.lines[2].lineTotal, 84 + 880);
  assert.deepEqual(p.lines[2].bundles.map((g) => [g.mainProductId, g.qty, g.unitDiscount, g.total]), [["big", 1, 16, 16], ["small", 10, 12, 120]]);
  eqSum(p);
});

test("ana adedi kuralı: 10 küçük + 1 büyük + 5 ampul → büyük 16 önce, sonra 4×12; farklı indirimler toplanmaz", () => {
  const p = run([L("small", 1000, 10), L("big", 1000, 1), L("bulb", 100, 5, { complementOf: [small, big] })]);
  assert.deepEqual(shape(p, 2), [[1, 84, "big"], [4, 88, "small"]]);
  assert.equal(p.lines[2].lineTotal, 84 + 4 * 88);
  eqSum(p);
});

test("ana adedi kuralı: en çok (kullanılan ana ürün sayısı + 1) satıra bölünür", () => {
  const tiny = pct("tiny", 5);
  const p = run([L("small", 1000, 10), L("big", 1000, 1), L("tiny", 1000, 1), L("bulb", 100, 14, { complementOf: [small, big, tiny] })]);
  assert.deepEqual(shape(p, 3), [[1, 84, "big"], [10, 88, "small"], [1, 95, "tiny"], [2, 100, null]]);
  assert.equal(shape(p, 3).length, 3 + 1);
  assert.equal(p.lines[3].lineTotal, 84 + 880 + 95 + 200);
  eqSum(p);
});

test("ana adedi kuralı: iki farklı avize aynı indirimle → ikisi ayrı grup (id sırası), toplanmaz", () => {
  const p = run([L("m1", 500, 1), L("m2", 500, 1), L("bulb", 100, 3, { complementOf: [pct("m2", 10), pct("m1", 10)] })]);
  assert.deepEqual(shape(p, 2), [[1, 90, "m1"], [1, 90, "m2"], [1, 100, null]]);
  eqSum(p);
});

test("ana adedi kuralı: ana ürün yok / bağsız ürün → indirim yok", () => {
  const none = run([L("bulb", 100, 4, { complementOf: [small] })]);
  assert.equal(none.lines[0].lineTotal, 400);
  assert.equal(none.lines[0].bundles, undefined);
  const unlinked = run([L("small", 1000, 3), L("bulb", 100, 4)]);
  assert.equal(unlinked.lines[1].lineTotal, 400);
  assert.deepEqual(shape(unlinked, 1), [[4, 100, null]]);
  const other = run([L("zzz", 1000, 3), L("bulb", 100, 4, { complementOf: [small] })]);
  assert.equal(other.lines[1].lineTotal, 400);
});

test("ana adedi kuralı: yüzde ve TL indirim; indirim ≥ birim fiyat olan bağın hakkı doğmaz", () => {
  const p = run([L("m1", 1000, 2), L("m2", 1000, 3), L("bulb", 100, 6, { complementOf: [pct("m1", 25), fix("m2", 30)] })]);
  assert.deepEqual(shape(p, 2), [[3, 70, "m2"], [2, 75, "m1"], [1, 100, null]]);
  assert.equal(p.lines[2].lineTotal, 210 + 150 + 100);
  const over = run([L("m1", 1000, 5), L("m2", 1000, 1), L("bulb", 100, 4, { complementOf: [fix("m1", 100), fix("m2", 20)] })]);
  assert.deepEqual(shape(over, 2), [[1, 80, "m2"], [3, 100, null]]); // m1 hakkı doğmaz (indirim = fiyat)
  eqSum(p); eqSum(over);
});

test("ana adedi kuralı: kuruş yuvarlama; satır, kalem ve sepet toplamı eşit", () => {
  for (const [price, qty, mq, rules] of [[33.33, 7, 3, [pct("m1", 7), pct("m2", 12.5)]], [19.99, 9, 4, [pct("m1", 12.5), fix("m2", 0.07)]], [0.2, 6, 2, [fix("m1", 0.07), pct("m2", 33.33)]]]) {
    const p = run([L("m1", 1000, mq), L("m2", 1000, 2), L("bulb", price, qty, { complementOf: rules })]);
    const rows = splitPricedLine(p.lines[2]);
    assert.equal(r2(rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0)), r2(p.lines[2].lineTotal), `${price} × ${qty}`);
    assert.equal(rows.reduce((s, r) => s + r.quantity, 0), qty);
    assert.ok(rows.length <= p.lines[2].bundles.length + 1);
    eqSum(p);
  }
});

test("ana adedi kuralı: kademe sonrası birim fiyat üzerinden hesap; sepet = kalemler = (PayTR sepeti kalemlerle aynı)", () => {
  const tiers = [{ minQty: 5, type: "PERCENT", value: 10 }];
  const p = run([L("small", 1000, 3), L("big", 1000, 1), L("bulb", 100, 6, { complementOf: [small, big], tiers })]);
  assert.equal(p.lines[2].unitPrice, 90); // kademe sonrası
  assert.deepEqual(shape(p, 2), [[1, 90 - 14.4, "big"], [3, 90 - 10.8, "small"], [2, 90, null]]);
  eqSum(p);
  const basket = p.lines.flatMap((l) => splitPricedLine(l)).map((r) => ({ price: r.unitPrice, quantity: r.quantity }));
  assert.equal(r2(basket.reduce((s, r) => s + r.price * r.quantity, 0)), r2(p.itemsTotal));
});
