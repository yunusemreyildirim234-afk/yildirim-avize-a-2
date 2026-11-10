import test from "node:test";
import assert from "node:assert/strict";
import { bankPaymentDeadline, breakdownOf, breakdownRows, deliveryAddressText, formatIstanbul, orderBreakdown, orderShippingFee } from "../lib/order-display.ts";
import { readFileSync } from "node:fs";
import { BANK_ORDER_HOLD_HOURS } from "../lib/stock-rules.ts";

test("son ödeme = sipariş + BANK_ORDER_HOLD_HOURS", () => {
  const c = new Date("2026-11-10T10:00:00Z");
  assert.equal(bankPaymentDeadline(c).getTime() - c.getTime(), BANK_ORDER_HOLD_HOURS * 3_600_000);
});

test("İstanbul saatiyle biçimlenir (UTC+3)", () => {
  const s = formatIstanbul(new Date("2026-11-10T10:00:00Z"));
  assert.match(s, /13[.:]00/);
  assert.match(s, /Kasım/);
});

test("tutar dökümü indirim farkını verir, negatif olmaz", () => {
  assert.deepEqual(orderBreakdown(1000, 100, 1045), { itemsSum: 1000, shipping: 100, discount: 55, total: 1045 });
  assert.equal(orderBreakdown(1000, 0, 1000).discount, 0);
  assert.equal(orderBreakdown(100, 0, 120).discount, 0);
});

const nb = (s) => s.replace(/\u00a0/g, " ");

test("E1/E3: e-posta döküm metni: ürünler, kargo, indirimler, toplam (onay sayfasıyla aynı satırlar)", () => {
  // 309 ₺ ürün + 100 ₺ kargo, kupon ve havale indirimi sonrası 374 ₺ (canlı gezi örneği)
  const b = breakdownOf([{ unitPrice: 309, quantity: 1 }], "STANDART_KARGO", 374);
  assert.deepEqual(b, { itemsSum: 309, shipping: 100, discount: 35, total: 374 });
  assert.deepEqual(breakdownRows(b).map((r) => [r.label, nb(r.value), r.kind]), [
    ["Ürünler", "309,00 ₺", "plain"],
    ["Kargo", "100,00 ₺", "plain"],
    ["İndirimler", "-35,00 ₺", "discount"],
    ["Toplam", "374,00 ₺", "total"],
  ]);
});

test("E1: indirim yoksa satırı çıkmaz; eşik üstü ve mağazadan teslimde kargo Ücretsiz", () => {
  assert.equal(orderShippingFee(349.99, "STANDART_KARGO"), 100);
  assert.equal(orderShippingFee(350, "STANDART_KARGO"), 0);
  assert.equal(orderShippingFee(100, "BEYOGLU_MAGAZA_TESLIM"), 0);
  const rows = breakdownRows(breakdownOf([{ unitPrice: 500, quantity: 2 }], "STANDART_KARGO", 1000));
  assert.deepEqual(rows.map((r) => [r.label, nb(r.value)]), [["Ürünler", "1.000,00 ₺"], ["Kargo", "Ücretsiz"], ["Toplam", "1.000,00 ₺"]]);
});

test("E1/E3: teslimat adresi: adrese teslimde il/ilçe dahil, mağazadan teslimde mağaza metni", () => {
  assert.equal(deliveryAddressText({ shippingType: "STANDART_KARGO", address: " Örnek Sk. No:1 ", buyerCityName: "Beyoğlu", buyerStateName: "İstanbul" }, "MAĞAZA"), "Örnek Sk. No:1, Beyoğlu / İstanbul");
  assert.equal(deliveryAddressText({ shippingType: "STANDART_KARGO", address: "Örnek Sk.", buyerCityName: null, buyerStateName: null }, "MAĞAZA"), "Örnek Sk.");
  assert.equal(deliveryAddressText({ shippingType: "BEYOGLU_MAGAZA_TESLIM", address: "yazılmış olsa da", buyerStateName: "İstanbul" }, "MAĞAZA"), "Mağazadan teslim: MAĞAZA");
  assert.equal(deliveryAddressText({ shippingType: "STANDART_KARGO" }, "MAĞAZA"), "-");
});

test("E1/E2/E3: şablon: döküm ortak yardımcıdan, havalede bekleme metni, sipariş ve panel bağlantısı", () => {
  const src = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
  assert.match(src, /breakdownRows\(breakdownOf\(/);
  assert.match(src, /\$\{SITE_URL\}\/siparis-onay\/\$\{data\.orderId\}/);
  assert.match(src, /Siparişi görüntüle/);
  assert.match(src, /Ödemeniz bekleniyor\. Havale\/EFT açıklamasına sipariş kodunuzu yazın; ödemeniz onaylandığında siparişiniz hazırlanacaktır\./);
  assert.match(src, /isBank\s*\?[^:]*Ödemeniz bekleniyor[^:]*:\s*"[^"]*ışık testleri/, "ışık testi metni yalnızca kartlı siparişte");
  assert.match(src, /formatIstanbul\(bankPaymentDeadline\(data\.createdAt\)\)/);
  assert.match(src, /\/admin\?durum=tumu#siparisler/);
  assert.match(src, /Teslimat Adresi<\/td>/);
  const page = readFileSync(new URL("../app/siparis-onay/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /breakdownRows\(breakdown\)/, "onay sayfası aynı satır listesini kullanır");
});
