import test from "node:test";
import assert from "node:assert/strict";
import { bankPaymentDeadline, breakdownOf, breakdownRows, deliveryAddressText, formatIstanbul, orderBreakdown, orderCode, orderShippingFee } from "../lib/order-display.ts";
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
  assert.ok(src.includes("adminOrderUrl = `${SITE_URL}${adminOrderHref(data.orderId)}`"), "yönetici e-postası sipariş detay sayfasına bağlanır");
  assert.match(src, /Teslimat Adresi<\/td>/);
  const page = readFileSync(new URL("../app/siparis-onay/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /breakdownRows\(breakdown\)/, "onay sayfası aynı satır listesini kullanır");
});

test("M5: Sipariş Kodu = sipariş kimliğinin ilk 8 hanesi (yönetim listesindeki kısaltmayla aynı)", () => {
  assert.equal(orderCode("556c47cc-c15d-4115-9d19-33e1bd64b8e9"), "556c47cc");
  assert.equal(orderCode("abc"), "abc");
  const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /order\.id\.slice\(0, 8\)/, "yönetim listesi de ilk 8 haneyi gösterir");
});

test("M5: havale kartı, onay sayfası ve e-postalar tam kimliği değil 8 haneli kodu gösterir/kopyalar; tek ad: Sipariş Kodu", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const card = read("../components/BankTransferCard.tsx");
  assert.match(card, /CopyCodeButton text=\{orderCode\(orderId\)\}/);
  assert.ok(!/\{orderId\}<\/p>/.test(card));
  const page = read("../app/siparis-onay/[id]/page.tsx");
  assert.match(page, /CopyCodeButton text=\{orderCode\(order\.id\)\}/);
  const mail = read("../lib/email.ts");
  assert.match(mail, /Sipariş Kodunuzu \(\$\{orderCode\(data\.orderId\)\}\)/);
  for (const [name, src] of [["kart", card], ["sayfa", page], ["e-posta", mail]]) {
    assert.ok(!/Sipariş Numaran|Sipariş Numarası|Sipariş Takip Kodu|Sipariş No</.test(src), `${name}: eski adlandırma kalmamalı`);
  }
  // Tam kimlik e-postada yalnızca bağlantılarda kalır
  const outside = mail.replace(/\/siparis-onay\/\$\{data\.orderId\}/g, "").replace(/orderCode\(data\.orderId\)/g, "");
  assert.ok(!/\$\{(esc\()?data\.orderId\)?\}/.test(outside), "e-posta gövdesinde çıplak tam kimlik kalmamalı");
});

test("A8/C2: sipariş silinirken onay sayfasına giden müşteri bildirimi de aynı transaction'da silinir", async () => {
  const { orderNotificationLink } = await import("../lib/order-display.ts");
  assert.equal(orderNotificationLink("abc-1"), "/siparis-onay/abc-1");
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  // Bildirim oluşturulurken yazılan bağlantı, silmede aranan bağlantıyla aynı biçimde olmalı
  assert.match(read("../lib/orders.ts"), /link: `\/siparis-onay\/\$\{order\.id\}`/);
  const route = read("../app/api/admin/orders/route.ts");
  const tx = route.indexOf("prisma.$transaction(");
  const del = route.indexOf("tx.notification.deleteMany({ where: { link: { in: ids.map(orderNotificationLink) } } })");
  assert.ok(tx > 0 && del > tx && del < route.indexOf("tx.order.deleteMany("), "bildirim silme, sipariş silmeyle aynı transaction'da ve ondan önce");
});
