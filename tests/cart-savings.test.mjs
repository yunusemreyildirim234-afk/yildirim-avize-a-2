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
const { lineSavings, listTotalOf, productDiscountOf, referenceUnit, totalSavings } = await import("../lib/cart-savings.ts");

const item = (price, listPrice, quantity, productId = "p1") => ({ variationId: `v-${productId}`, productId, price, listPrice, quantity, tiers: [], couponAllowed: true, pickupPct: null, transferPct: null });
const run = (items, shippingType, paymentMethod, coupon = null) => {
  const priced = priceCart({ lines: items, shippingType, paymentMethod, coupon });
  const sav = totalSavings(items, priced.total, priced.shipping);
  const listTotal = items.reduce((s, i) => s + referenceUnit(i) * i.quantity, 0);
  // Değişmez: kazanç = (liste − ürünler) + kupon + mağaza + havale (kargo hiçbir yönde sayılmaz)
  const expected = listTotal - priced.itemsTotal + priced.couponDiscount + priced.pickupDiscount + priced.bankDiscount;
  assert.ok(Math.abs(sav - expected) < 0.011, `kazanç ${sav} != ${expected}`);
  return { priced, sav };
};

test("kart, liste fiyatı var: kazanç yalnızca liste farkı", () => {
  const { sav } = run([item(28999, 29299, 1)], "STANDART_KARGO", "CREDIT_CARD");
  assert.equal(sav, 300);
});

test("havale: liste farkı + %5 havale indirimi", () => {
  const { priced, sav } = run([item(28999, 29299, 1)], "STANDART_KARGO", "BANK_TRANSFER");
  assert.equal(priced.bankDiscount, Math.round(28999 * 0.05));
  assert.equal(sav, 300 + priced.bankDiscount);
});

test("mağazadan teslim: liste farkı + mağaza indirimi (kargo ücretsizliği sayılmaz)", () => {
  const { priced, sav } = run([item(200, 250, 1)], "BEYOGLU_MAGAZA_TESLIM", "CREDIT_CARD");
  assert.equal(priced.shipping, 0);
  assert.equal(sav, 50 + priced.pickupDiscount);
});

test("kargo ücretli sepet: kargo toplamdan düşülür, kazanca girmez", () => {
  const { priced, sav } = run([item(200, 250, 1)], "STANDART_KARGO", "CREDIT_CARD");
  assert.ok(priced.shipping > 0);
  assert.equal(sav, 50);
});

test("liste fiyatı yok, indirim yok: kazanç 0 (satır gizlenir)", () => {
  const { sav } = run([item(1000, null, 2)], "STANDART_KARGO", "CREDIT_CARD");
  assert.equal(sav, 0);
});

test("kuponlu havale, iki ürün, adetli", () => {
  const items = [item(10000, 12000, 2, "a"), item(5000, null, 1, "b")];
  const { priced, sav } = run(items, "STANDART_KARGO", "BANK_TRANSFER", { code: "TEST", discountType: "PERCENT", discountPercent: 10 });
  assert.ok(priced.couponDiscount > 0 && priced.bankDiscount > 0);
  assert.equal(sav, 4000 + priced.couponDiscount + priced.bankDiscount);
});

test("satır kazancı ve bayat liste fiyatı", () => {
  assert.equal(lineSavings({ price: 100, listPrice: 150, quantity: 3 }, 100), 150);
  assert.equal(referenceUnit({ price: 100, listPrice: 90 }), 100); // liste < güncel fiyat: çizili gösterilmez
  assert.equal(lineSavings({ price: 100, listPrice: 90, quantity: 2 }, 100), 0);
});

test("özet sütunu: liste − ürün indirimi + kargo − kupon − havale = Toplam Tutar (kuponlu havale, ürün indirimli)", () => {
  const items = [item(10000, 10300, 2, "a"), item(5000, null, 1, "b")];
  const priced = priceCart({ lines: items, shippingType: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER", coupon: { code: "T", discountType: "PERCENT", discountPercent: 10 } });
  const pd = productDiscountOf(items, priced.itemsTotal);
  assert.equal(pd, 600);
  const column = listTotalOf(items) - pd + priced.shipping - priced.couponDiscount - priced.pickupDiscount - priced.bankDiscount;
  assert.ok(Math.abs(column - priced.total) < 0.011);
  // kazanç = ürün indirimi + diğer indirimler
  assert.ok(Math.abs(totalSavings(items, priced.total, priced.shipping) - (pd + priced.couponDiscount + priced.bankDiscount)) < 0.011);
});

test("ürün indirimsiz sepette ürün indirimi 0 (iki satır gösterilmez)", () => {
  const items = [item(1000, null, 2)];
  const priced = priceCart({ lines: items, shippingType: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER" });
  assert.equal(productDiscountOf(items, priced.itemsTotal), 0);
});
