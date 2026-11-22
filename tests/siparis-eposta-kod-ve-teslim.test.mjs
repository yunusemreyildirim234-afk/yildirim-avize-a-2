import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

// Sahte Resend: gerçek e-posta gitmez, istekler yakalanır
process.env.RESEND_API_KEY = "test-key";
const sent = [];
globalThis.fetch = async (_url, init) => {
  sent.push(JSON.parse(init.body));
  return { ok: true, json: async () => ({}) };
};
const { sendOrderNotificationEmails } = await import("../lib/email.ts");

const base = {
  orderId: "11112222-3333-4444-5555-666677778888",
  customerName: "Test Müşteri",
  customerEmail: "musteri@example.com",
  totalAmount: 1000,
  paymentMethod: "CREDIT_CARD",
  kargonomiShipmentId: 4321,
  shippingBarcode: "YA-ABC123",
  items: [{ title: "Avize", variationName: "Gold", quantity: 1, price: 1000 }],
};

async function run(shippingType) {
  sent.length = 0;
  await sendOrderNotificationEmails({ ...base, shippingType });
  const customer = sent.find((m) => String(m.subject).startsWith("Siparişiniz Alındı"));
  const admin = sent.find((m) => String(m.subject).startsWith("Yeni Sipariş Geldi"));
  return { customer: customer.html, admin: admin.html };
}

test("kargo siparişi: müşteri e-postasında YA- kodu / Paket Barkodu yok, kargo cümlesi aynı; yönetici e-postasında blok duruyor", async () => {
  const { customer, admin } = await run("STANDART_KARGO");
  assert.doesNotMatch(customer, /YA-ABC123/);
  assert.doesNotMatch(customer, /Paket Barkodu/);
  assert.doesNotMatch(customer, /Kargo Kaydı/);
  assert.match(customer, /Avizeniz kargoya verildiğinde tarafınıza tekrar bilgilendirme yapılacaktır\./);
  assert.match(admin, /Kargo Kaydı/);
  assert.match(admin, /YA-ABC123/);
  assert.match(admin, /Paket Barkodu/);
});

test("mağazadan teslim: müşteriye teslime hazır cümlesi, kargo cümlesi yok", async () => {
  const { customer, admin } = await run("BEYOGLU_MAGAZA_TESLIM");
  assert.match(customer, /Siparişiniz mağazada teslime hazır olduğunda size bilgi vereceğiz\./);
  assert.doesNotMatch(customer, /kargoya verildiğinde/);
  assert.doesNotMatch(customer, /YA-ABC123/);
  assert.doesNotMatch(admin, /Kargo Kaydı/);
});
