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
  assert.deepEqual(withMain.lines[1].bundle, { mainProductId: "main", unitDiscount: 10, total: 10 });
  const noMain = price([item("vc", "comp", 100, { rules: RULES })]);
  assert.equal(noMain.lines[0].unitPrice, 100);
  assert.equal(noMain.lines[0].bundle, undefined);
});

test("bundleLineView: etiket ve indirimsiz birim fiyat; bağ yoksa null", () => {
  assert.equal(bundleLineView(undefined, 90), null);
  assert.equal(bundleLineView(null, 90), null);
  const v = bundleLineView({ mainProductId: "main", unitDiscount: 10, total: 10 }, 100); // unitPrice = normal birim
  assert.equal(v.label, "Birlikte alma indirimi");
  assert.equal(v.regularUnit, 100);
  assert.equal(v.discountedUnit, 90);
  assert.match(v.text, /1 adet için/);
  assert.match(v.text, /10,00 ₺/);
});

test("lostBundleTitles: ana ürün çıkınca tamamlayıcının indirimi kalkar → başlık döner", () => {
  const b = { mainProductId: "main", unitDiscount: 10, total: 10 };
  const prev = [{ variationId: "vm", title: "Avize" }, { variationId: "vc", title: "Ampul", bundle: b }];
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vc", available: true, bundle: null }]), ["Ampul"]);
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vm" }, { variationId: "vc", bundle: b }]), []); // hâlâ var
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vm" }]), []); // tamamlayıcının kendisi çıktı
  assert.deepEqual(lostBundleTitles(prev, [{ variationId: "vc", available: false }]), []);
  assert.deepEqual(lostBundleTitles(undefined, [{ variationId: "vc" }]), []);
  assert.deepEqual(lostBundleTitles([{ variationId: "vc", title: "Ampul" }], [{ variationId: "vc" }]), []); // önceden de yoktu
});

test("shownUnitPrice / lineBreakdownExpr: tek adette indirimli birim; çok adette 1 × indirimli + kalan × normal", () => {
  const b = { mainProductId: "main", unitDiscount: 10, total: 10 };
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 1, bundle: b }), 90);
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 6, bundle: b }), 100);
  assert.equal(shownUnitPrice({ unitPrice: 100, quantity: 6 }), 100);
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 6, bundle: b }), "1 × 90,00 ₺ + 5 × 100,00 ₺");
  assert.equal(lineBreakdownExpr({ unitPrice: 100, quantity: 6 }), "6 × 100,00 ₺");
});
