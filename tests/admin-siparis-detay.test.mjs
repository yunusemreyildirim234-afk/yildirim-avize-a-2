import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminOrderHref, paymentMethodLabel } from "../lib/admin-order-detail.ts";
import { buildLatePaymentEmail } from "../lib/late-payment.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("detay bağlantısı: geçerli kimlik sayfaya, geçersiz kimlik listeye gider", () => {
  assert.equal(adminOrderHref("abcdef12-3456-7890"), "/admin/siparis/abcdef12-3456-7890");
  for (const bad of ["", "a/b", "../x", "a b", "x".repeat(65), "<s>"]) assert.equal(adminOrderHref(bad), "/admin?durum=tumu#siparisler", bad);
});

test("ödeme etiketi", () => {
  assert.equal(paymentMethodLabel("CREDIT_CARD"), "Kredi Kartı");
  assert.equal(paymentMethodLabel("BANK_TRANSFER"), "Havale / EFT");
  assert.equal(paymentMethodLabel(null), "Belirtilmemiş");
});

test("sayfa: kimlik doğrulanır, bulunamazsa 404, mevcut bileşenler ve ortak döküm kullanılır", () => {
  const page = read("../app/admin/siparis/[id]/page.tsx");
  assert.match(page, /ID_RE\.test\(id\)\) notFound\(\)/);
  assert.match(page, /if \(!order\) notFound\(\)/);
  for (const s of ["OrderStatusSelector", "AdminKargonomiOrderActions", "AdminOrderRequest", "orderItemProductView", "breakdownRows(breakdownOf(", "cleanGuestEmail(order.user.email)", "deliveryAddressText", "bankPaymentDeadline"]) assert.ok(page.includes(s), s);
  const proxy = read("../proxy.ts");
  assert.match(proxy, /matcher: \["\/admin\/:path\*"/, "oturum denetimi /admin altındaki her yolu kapsar");
});

test("bağlantılar: liste satırı, yönetici e-postaları ve panel bildirimleri detay sayfasına gider", () => {
  assert.match(read("../app/admin/page.tsx"), /href=\{adminOrderHref\(order\.id\)\}/);
  const email = read("../lib/email.ts");
  assert.match(email, /const adminOrderUrl = `\$\{SITE_URL\}\$\{adminOrderHref\(data\.orderId\)\}`/);
  assert.match(email, /\$\{SITE_URL\}\$\{adminOrderHref\(data\.orderId\)\}">Yönetim panelinde incele/);
  assert.match(read("../app/api/orders/receipt/route.ts"), /link: adminOrderHref\(orderId\)/);
  assert.match(read("../app/api/orders/request/route.ts"), /link: adminOrderHref\(order\.id\)/);
  assert.match(read("../app/api/cron/reminders/route.ts"), /link: adminOrderHref\(o\.id\)/);
  assert.match(read("../lib/late-payment.ts"), /link: adminOrderHref\(info\.orderId\)/);
  const m = buildLatePaymentEmail({ orderId: "abcdef12-3456", orderStatus: "CANCELLED", merchantOid: "O", siteUrl: "https://x.test", order: null });
  assert.ok(m.html.includes("https://x.test/admin/siparis/abcdef12-3456"));
});

import { buildFis } from "../lib/admin-order-detail.ts";

const order = { id: "abcdef12-3456-7890", createdAt: new Date("2026-11-10T09:00:00Z"), shippingType: "STANDART_KARGO", phone: " 0555 111 22 33 ", address: " Ataşehir Mah. 5/2 ", buyerCityName: "Kadıköy", buyerStateName: "İstanbul", orderNote: " Zincir 80 cm ", paymentMethod: "BANK_TRANSFER", items: [{ quantity: 2, variationValue: "Altın", title: "Kristal Avize" }, { quantity: 1, variationValue: null, title: null }] };

test("hazırlık fişi verisi: kod, adres, telefon, not, ödeme yöntemi ve kalemler; fiyat alanı yok", () => {
  const f = buildFis(order, "Şişhane mağaza");
  assert.deepEqual(f, {
    code: "abcdef12",
    isPickup: false,
    phone: "0555 111 22 33",
    address: "Ataşehir Mah. 5/2, Kadıköy / İstanbul",
    note: "Zincir 80 cm",
    payment: "Havale / EFT",
    items: [{ title: "Kristal Avize", variation: "Altın", quantity: 2 }, { title: "Ürün", variation: "-", quantity: 1 }],
  });
  assert.ok(!/price|fiyat|total|toplam|discount/i.test(JSON.stringify(f)), "fişte para bilgisi yok");
});

test("hazırlık fişi: mağazadan teslimde mağaza adresi; eksik telefon/not güvenli", () => {
  const f = buildFis({ ...order, shippingType: "BEYOGLU_MAGAZA_TESLIM", phone: null, orderNote: "  ", paymentMethod: null }, "Şişhane mağaza");
  assert.equal(f.isPickup, true);
  assert.equal(f.address, "Mağazadan teslim: Şişhane mağaza");
  assert.equal(f.phone, "-");
  assert.equal(f.note, null);
  assert.equal(f.payment, "Belirtilmemiş");
});

test("yazdırma: fiş yalnızca yazdırmada görünür, sayfanın geri kalanı ve üst çubuk yazdırmada gizlidir, fişte döküm bileşeni yok", () => {
  const page = read("../app/admin/siparis/[id]/page.tsx");
  assert.match(page, /<section data-testid="hazirlik-fisi"[^>]*className="hidden print:block/);
  assert.match(page, /className="mx-auto max-w-5xl space-y-5 print:hidden"/);
  assert.match(page, /AdminPrintButton label="Hazırlık fişi yazdır"/);
  const fisHtml = page.slice(page.indexOf('data-testid="hazirlik-fisi"'), page.indexOf('<div className="mx-auto max-w-5xl'));
  assert.ok(!/formatTl|unitPrice|totalAmount|rows\.map|couponCode/.test(fisHtml), "fiyat dökümü fişte yok");
  assert.match(read("../components/AdminTopBar.tsx"), /className="print:hidden sticky top-0/);
  assert.match(read("../components/AdminPrintButton.tsx"), /window\.print\(\)/);
});
