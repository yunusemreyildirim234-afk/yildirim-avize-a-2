import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { carrierDativeName } = await import("../lib/carrier-links.ts");
const { buildShippedNotice } = await import("../lib/shipped-notice.ts");

const src = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");

test("kargo firması + yönelme eki", () => {
  assert.equal(carrierDativeName("Aras Kargo"), "Aras Kargo'ya");
  assert.equal(carrierDativeName("ARAS"), "Aras Kargo'ya");
  assert.equal(carrierDativeName("Hepsijet"), "Hepsijet'e");
  assert.equal(carrierDativeName("Kargo"), "kargo firmasına");
  assert.equal(carrierDativeName(null), "kargo firmasına");
});

test("buildShippedNotice koşulu aynı; takip kodu yoksa tür barcode", () => {
  const base = { shippingType: "STANDART_KARGO", shippingTrackingCode: "T1", shippingBarcode: "B1", shippingProviderName: "Aras Kargo" };
  assert.equal(buildShippedNotice(base).trackingKind, "code");
  assert.equal(buildShippedNotice({ ...base, shippingTrackingCode: null }).trackingKind, "barcode");
  assert.equal(buildShippedNotice({ ...base, shippingTrackingCode: null, shippingBarcode: null }), null);
  assert.equal(buildShippedNotice({ ...base, shippingType: "BEYOGLU_MAGAZA_TESLIM" }), null);
});

test("kargoya verildi e-postası: nowrap + user-select, etiket, sipariş bağlantısı, sabit 'ya yok", () => {
  const f = src.slice(src.indexOf("export async function sendShippedEmail"), src.indexOf("export async function sendInvoiceEmail"));
  assert.match(f, /white-space: nowrap; user-select: all/);
  assert.match(f, /Gönderi barkodu/);
  assert.match(f, /orderNotificationLink\(data\.orderId\)/);
  assert.match(f, /Siparişi görüntüle/);
  assert.doesNotMatch(f, /<\/strong>'ya/);
  assert.doesNotMatch(f, /\}'ya Verildi/);
});

test("sipariş onay e-postası metinleri", () => {
  assert.match(src, /Gönderilecek tutar: <strong>\$\{formatTl\(data\.totalAmount\)\}/);
  assert.doesNotMatch(src.slice(src.indexOf("const bankBlock"), src.indexOf("const itemRows")), /#b91c1c/);
  assert.match(src, /Avizeniz kargoya verildiğinde/);
  assert.doesNotMatch(src, /Avizeniz hazırlandığında/);
  const cust = src.slice(src.indexOf("const kargonomiBlock"), src.indexOf("const bankBlock"));
  assert.doesNotMatch(cust, /Kargonomi/);
  assert.match(cust, /Kargo Kaydı/);
  assert.match(cust, /Gönderi No:/);
});

// WCAG 2.x kontrast hesabı
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("turuncu: eski #d97706 beyazla <4.5, yeni EMAIL_ORANGE ≥4.5; amber uyarı ≥4.5", () => {
  const orange = src.match(/EMAIL_ORANGE = "(#[0-9a-f]{6})"/)[1];
  assert.ok(ratio("#d97706", "#ffffff") < 4.5, `eski ${ratio("#d97706", "#ffffff").toFixed(2)}`);
  assert.ok(ratio(orange, "#ffffff") >= 4.5, `yeni ${ratio(orange, "#ffffff").toFixed(2)}`);
  assert.ok(ratio(orange, "#fafafa") >= 4.5);
  assert.ok(ratio("#78350f", "#fef3c7") >= 4.5);
  assert.doesNotMatch(src.slice(src.indexOf("function breakdownHtml"), src.indexOf("export async function sendOrderNotificationEmails")), /#d97706/);
  assert.doesNotMatch(src.slice(src.indexOf("export async function sendReceiptReminderEmail"), src.indexOf("export async function sendBankOrderCancelledEmail")), /background: #d97706/);
});
