import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { buildLegalSummaryHtml } = await import("../lib/legal-email.ts");
const { AYIPLI_MAL, CAYMA, LEGAL_UPDATED, MONTAJ_NOTU, ODEME, TESLIMAT_SURESI } = await import("../lib/legal-texts.ts");
const email = await import("../lib/email.ts");

// HTML'deki metin, kaçışlı biçimde aranır (apostrof kaçışlanmaz)
const esc = (v) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

test("özet: legal-texts cümleleri aynen, iki bağlantı ve metin sürümü var", () => {
  const html = buildLegalSummaryHtml("https://www.yildirimavize.com.tr");
  for (const t of [CAYMA.hak, CAYMA.istisna, ODEME, TESLIMAT_SURESI, AYIPLI_MAL]) assert.ok(html.includes(esc(t)), t.slice(0, 40));
  assert.match(html, /href="https:\/\/www\.yildirimavize\.com\.tr\/mesafeli-satis-sozlesmesi"/);
  assert.match(html, /href="https:\/\/www\.yildirimavize\.com\.tr\/iptal-iade-cayma"/);
  assert.ok(html.includes(`Metin sürümü: ${LEGAL_UPDATED}`));
});

test("özet: montaj notu, 'sigortalı', ev montajı ve SMS sözü yok", () => {
  const html = buildLegalSummaryHtml("https://www.yildirimavize.com.tr");
  assert.ok(!html.includes(esc(MONTAJ_NOTU)));
  assert.doesNotMatch(html, /sigortal/i);
  assert.doesNotMatch(html, /montaj/i);
  assert.doesNotMatch(html, /SMS/i);
});

test("özet: site adresi HTML'de kaçışlıdır", () => {
  assert.doesNotMatch(buildLegalSummaryHtml('https://x.test/"><script>alert(1)</script>'), /<script/i);
});

test("sipariş e-postası: yalnız müşteri e-postasında özet var, yönetici e-postasında yok", async () => {
  const giden = [];
  process.env.RESEND_API_KEY = "test-anahtar";
  globalThis.fetch = async (url, init) => { giden.push(JSON.parse(init.body)); return { ok: true, json: async () => ({}) }; };
  console.error = () => {};
  await email.sendOrderNotificationEmails({
    orderId: "11111111-2222-3333-4444-555555555555", customerName: "Ayşe", customerEmail: "a@example.com", totalAmount: 500,
    shippingType: "STANDART_KARGO", paymentMethod: "CREDIT_CARD", items: [{ title: "Avize", variationName: "Altın", quantity: 1, price: 500 }],
  });
  const musteri = giden.find((g) => String(g.subject).startsWith("Siparişiniz Alındı"));
  const yonetici = giden.find((g) => String(g.subject).startsWith("Yeni Sipariş"));
  assert.ok(musteri && yonetici);
  assert.ok(musteri.html.includes("Ön Bilgilendirme ve Sözleşme Özeti"));
  assert.ok(musteri.html.includes(LEGAL_UPDATED));
  assert.ok(!yonetici.html.includes("Ön Bilgilendirme ve Sözleşme Özeti"));
  assert.doesNotMatch(musteri.html, /sigortal/i);
});
