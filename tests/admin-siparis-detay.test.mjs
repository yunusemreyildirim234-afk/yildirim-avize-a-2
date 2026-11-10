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
