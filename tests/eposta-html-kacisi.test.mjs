import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const email = await import("../lib/email.ts");

const XSS = `<script>alert(1)</script>`;
const IMG = `<img src=x onerror=alert(2)>`;
// Resend'e giden istek yakalanır; gerçek ağ çağrısı yok. Anahtar sahte bir değerdir.
function yakala() {
  const giden = [];
  process.env.RESEND_API_KEY = "test-anahtar";
  globalThis.fetch = async (url, init) => { giden.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, json: async () => ({}) }; };
  console.error = () => {};
  return giden;
}
const htmlOf = (giden) => giden.map((g) => g.body.html).join("\n").replace(EMAIL_LOGO_RE, "");
const EMAIL_LOGO_RE = /<img src="https:\/\/www\.yildirimavize\.com\.tr\/email-logo-v3\.png"[^>]*>/g;
function temiz(html) {
  // Logo dışında hiç <script>/<img> etiketi ve çözülmüş olay özniteliği kalmamalı
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img[^>]*onerror/i);
  assert.doesNotMatch(html.replace(EMAIL_LOGO_RE, ""), /<img/i);
}

test("sipariş e-postaları (müşteri + yönetici): ad, not, adres, ürün, kupon, fatura alanlarında HTML kaçışlı", async () => {
  const giden = yakala();
  await email.sendOrderNotificationEmails({
    orderId: "11111111-2222-3333-4444-555555555555", customerName: XSS, recipientName: IMG, customerEmail: "a@example.invalid", customerPhone: XSS,
    orderNote: XSS, invoiceType: "CORPORATE", taxNumber: XSS, taxOffice: IMG, companyTitle: XSS, totalAmount: 500, shippingType: "STANDART_KARGO",
    paymentMethod: "CREDIT_CARD", couponCode: XSS, address: IMG, buyerCityName: XSS, buyerStateName: IMG,
    shippingProviderName: XSS, shippingTrackingCode: XSS, shippingBarcode: IMG,
    items: [{ title: XSS, variationName: IMG, quantity: 1, price: 500 }],
  });
  assert.ok(giden.length >= 1);
  const html = htmlOf(giden);
  temiz(html);
  assert.match(html, /&lt;script&gt;/);
});

test("iletişim/yanıt/soru e-postaları: ad, e-posta, mesaj, ürün başlığı kaçışlı", async () => {
  const giden = yakala();
  await email.sendNewMessageEmail({ kind: "PRODUCT_QUESTION", subject: XSS, name: XSS, email: IMG, phone: XSS, message: `${XSS}\n${IMG}`, productTitle: IMG });
  await email.sendReplyEmail({ to: "a@example.com", name: XSS, question: `${XSS}\n${IMG}`, productTitle: IMG, reply: `${IMG}\n${XSS}` });
  await email.sendReviewAdminEmail({ productTitle: XSS, productId: "p", rating: 5, comment: IMG, name: XSS, email: IMG });
  assert.ok(giden.length >= 3);
  temiz(htmlOf(giden));
});

test("hesap, kupon, hatırlatma, talep ve kargo e-postaları: kullanıcıdan gelen alanlar kaçışlı", async () => {
  const giden = yakala();
  const to = "a@example.com";
  await email.sendAccountDeletionRequestedEmail({ to, name: XSS });
  await email.sendAccountDeletedEmail({ to, name: IMG });
  await email.sendAbandonedCartEmail({ to, name: XSS, orderId: "o", items: [{ title: IMG, quantity: 1 }], couponCode: XSS, discountLabel: IMG, footerHtml: "" });
  await email.sendCartReminderEmail({ to, name: XSS, items: [{ title: IMG, quantity: 1 }] });
  await email.sendCampaignCouponEmail({ to, name: XSS, code: IMG, discountPercent: 5, footerHtml: "" });
  await email.sendReceiptReminderEmail({ to, name: XSS, orderId: "11111111-2222-3333-4444-555555555555" });
  await email.sendBankOrderCancelledEmail({ to, name: IMG, orderId: "11111111-2222-3333-4444-555555555555", hours: 48 });
  await email.sendReceiptUploadedAdminEmail({ orderId: "11111111-2222-3333-4444-555555555555", senderName: XSS, customerName: IMG, totalAmount: 10 });
  await email.sendStockShortageEmail({ orderId: "o", items: [{ product: XSS, color: IMG, quantity: 1 }] });
  await email.sendRequestAdminEmail({ type: "CANCEL", orderId: "11111111-2222-3333-4444-555555555555", customerName: XSS, customerEmail: IMG, reason: XSS });
  await email.sendRequestDecisionEmail({ to, name: XSS, type: "CANCEL", approved: false, orderId: "11111111-2222-3333-4444-555555555555", note: IMG });
  await email.sendShippedEmail({ to, name: XSS, orderId: "11111111-2222-3333-4444-555555555555", carrier: IMG, trackingNumber: XSS });
  assert.ok(giden.length >= 10);
  temiz(htmlOf(giden));
});

test("silinmiş hesabın .invalid adresine istek hiç gitmez", async () => {
  const giden = yakala();
  const ok = await email.sendAccountDeletedEmail({ to: "silinmis-1@silinmis.invalid", name: "A" });
  assert.equal(giden.length, 0);
  assert.notEqual(ok, true);
});

test("terk edilmiş sepet e-postası: vitrin kuponu herkese açık, 'size özel kuponunuz' denmez", async () => {
  const giden = yakala();
  await email.sendAbandonedCartEmail({ to: "a@example.com", name: "Ayşe", orderId: "o", items: [{ title: "Avize", quantity: 1 }], couponCode: "YILDIRIM5", discountLabel: "%5", footerHtml: "" });
  const { subject, html } = giden[0].body;
  assert.equal(subject, "Sepetiniz sizi bekliyor — %5 indirim kodu"); // kısa konu; kupon kodu gövdede
  assert.match(html, /YILDIRIM5/);
  assert.match(html, /Sepetinizi tamamlarken kullanabileceğiniz <strong>%5 indirim<\/strong> kodu:/);
  assert.doesNotMatch(subject + html, /size özel|kuponunuz/i);
});
