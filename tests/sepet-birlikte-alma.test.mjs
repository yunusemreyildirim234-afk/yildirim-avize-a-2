import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_alias-hooks.mjs", import.meta.url);

const { cartPriceLines } = await import("../lib/cart-lines.ts");
const { bundleLineView, lostBundleTitles, shownUnitPrice, lineBreakdownExpr } = await import("../lib/cart-bundle.ts");
const { priceCart } = await import("../lib/cart-pricing.ts");

const item = (variationId, productId, price, over = {}) => ({ variationId, productId, price, quantity: 1, bulk: [], ...over });
const price = (cart) => priceCart({ lines: cartPriceLines(cart), shippingType: "STANDART_KARGO", paymentMethod: "CREDIT_CARD" });
const RULES = { couponAllowed: true, pickupPct: null, transferPct: null, complementOf: [{ mainProductId: "main", type: "PERCENT", value: 10 }] };

test("cartPriceLines: complementOf yoksa alan hiç eklenmez (eski sonuç birebir)", () => {
  const lines = cartPriceLines([item("v1", "p1", 100)]);
  assert.equal("complementOf" in lines[0], false);
  assert.equal(price([item("v1", "p1", 100)]).itemsTotal, 100);
});

test("cartPriceLines: complementOf taşınır; ana ürün sepetteyken tamamlayıcı indirimli, yokken değil", () => {
  const withMain = price([item("vm", "main", 1000), item("vc", "comp", 100, { rules: RULES })]);
  assert.equal(withMain.lines[1].lineTotal, 90); // 1 adet: indirimli
  assert.equal(withMain.lines[1].unitPrice, 100); // normal birim
  assert.deepEqual(withMain.lines[1].bundles, [{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }]);
  const noMain = price([item("vc", "comp", 100, { rules: RULES })]);
  assert.equal(noMain.lines[0].unitPrice, 100);
  assert.equal(noMain.lines[0].bundles, undefined);
});

test("bundleLineView: etiket ve indirimsiz birim fiyat; bağ yoksa null", () => {
  assert.equal(bundleLineView(undefined, 90), null);
  assert.equal(bundleLineView(null, 90), null);
  const v = bundleLineView([{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }], 100); // unitPrice = normal birim
  assert.equal(v.label, "Birlikte alma indirimi");
  assert.equal(v.regularUnit, 100);
  assert.equal(v.discountedUnit, 90);
  assert.match(v.text, /1 adet için/);
  assert.match(v.text, /10,00 ₺/);
});

test("lostBundleTitles: ana ürün çıkınca tamamlayıcının indirimi kalkar → başlık döner", () => {
  const b = [{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }];
  const prev = [{ variationId: "vm", title: "Avize" }, { variationId: "vc", title: "Ampul", bundles: b }];
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vc", available: true, bundles: [] }]), ["Ampul"]);
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vm" }, { variationId: "vc", bundles: b }]), []); // hâlâ var
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vm" }]), []); // tamamlayıcının kendisi çıktı
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vc", available: false }]), []);
  assert.deepEqual(lostBundleTitles(undefined, [{ variationId: "vc" }]), []);
  assert.deepEqual(lostBundleTitles([{ variationId: "vc", title: "Ampul" }], [{ variationId: "vc" }]), []); // önceden de yoktu
});

test("shownUnitPrice / lineBreakdownExpr: tek adette indirimli birim; çok adette 1 × indirimli + kalan × normal", () => {
  const b = [{ mainProductId: "main", unitDiscount: 10, qty: 1, total: 10 }];
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 1, bundles: b }), 90);
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 6, bundles: b }), 100);
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 6 }), 100);
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 6, bundles: b }), "1 × 90,00 ₺ + 5 × 100,00 ₺");
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 6 }), "6 × 100,00 ₺");
});

test("çok gruplu satır: metin ve döküm yeni bölmeyi söyler (10 × … + 1 × … + kalan)", () => {
  const g = [{ mainProductId: "big", unitDiscount: 16, qty: 1, total: 16 }, { mainProductId: "small", unitDiscount: 12, qty: 10, total: 120 }];
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 13, bundles: g }), "1 × 84,00 ₺ + 10 × 88,00 ₺ + 2 × 100,00 ₺");
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 11, bundles: g }), "1 × 84,00 ₺ + 10 × 88,00 ₺");
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 11, bundles: g }), 100);
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 2, bundles: [{ mainProductId: "m", unitDiscount: 10, qty: 2, total: 20 }] }), 90);
  assert.match(bundleLineView(g, 100).text, /11 adet için\): 136,00 ₺$/);
});

test("aynı fiyatlı çoklu ana ürün: tek parça, indirimli büyük fiyat, tek ana ürünle aynı görünüm", () => {
  const multi = [{ mainProductId: "a", unitDiscount: 9.9, qty: 2, total: 19.8 }, { mainProductId: "b", unitDiscount: 9.9, qty: 1, total: 9.9 }];
  const one = [{ mainProductId: "a", unitDiscount: 9.9, qty: 3, total: 29.7 }];
  const line = { unitPrice: 99, quantity: 3 };
  assert.equal(lineBreakdownExpr({ ...line, bundles: multi }), "3 × 89,10 ₺");
  assert.equal(lineBreakdownExpr({ ...line, bundles: multi }), lineBreakdownExpr({ ...line, bundles: one }));
  assert.equal(shownUnitPrice({ ...line, bundles: multi }), 89.1);
  assert.equal(bundleLineView(multi, 99).text, "Birlikte alma indirimi (3 adet için): 29,70 ₺ (birim 99,00 ₺ yerine 89,10 ₺)");
  assert.equal(bundleLineView(multi, 99).text, bundleLineView(one, 99).text);
});

test("indirimli + indirimsiz karışık: büyük fiyat normal, parçalar ayrı", () => {
  const multi = [{ mainProductId: "a", unitDiscount: 9.9, qty: 2, total: 19.8 }, { mainProductId: "b", unitDiscount: 9.9, qty: 1, total: 9.9 }];
  assert.equal(shownUnitPrice({ unitPrice: 99, quantity: 5, bundles: multi }), 99);
  assert.equal(lineBreakdownExpr({ unitPrice: 99, quantity: 5, bundles: multi }), "3 × 89,10 ₺ + 2 × 99,00 ₺");
});

test("farklı indirimli birim fiyatlar: büyük fiyat normal, fiyata göre gruplu, birim notu yok", () => {
  const g = [{ mainProductId: "a", unitDiscount: 16, qty: 1, total: 16 }, { mainProductId: "b", unitDiscount: 12, qty: 1, total: 12 }, { mainProductId: "c", unitDiscount: 12, qty: 1, total: 12 }];
  assert.equal(shownUnitPrice({ unitPrice: 99, quantity: 3, bundles: g }), 99);
  assert.equal(lineBreakdownExpr({ unitPrice: 99, quantity: 3, bundles: g }), "1 × 83,00 ₺ + 2 × 87,00 ₺");
  assert.doesNotMatch(bundleLineView(g, 99).text, /birim/);
});

test("toplam değişmez: gösterim parçaları toplamı = bağ indirimli satır toplamı", () => {
  const g = [{ mainProductId: "a", unitDiscount: 16, qty: 1, total: 16 }, { mainProductId: "b", unitDiscount: 12, qty: 2, total: 24 }];
  const quantity = 4, unitPrice = 99;
  const lineTotal = unitPrice * quantity - g.reduce((s, x) => s + x.total, 0);
  const expr = lineBreakdownExpr({ unitPrice, quantity, bundles: g });
  const sum = expr.split(" + ").reduce((s, p) => { const [q, u] = p.replace(" ₺", "").split(" × "); return s + Number(q) * Number(u.replace(",", ".")); }, 0);
  assert.equal(Math.round(sum * 100) / 100, lineTotal);
});
