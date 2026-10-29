interface EmailOrderData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  shippingType: string;
  paymentMethod?: string | null;
  kargonomiShipmentId?: number | null;
  shippingProviderName?: string | null;
  shippingTrackingCode?: string | null;
  shippingBarcode?: string | null;
  items: Array<{ title: string; variationName: string; quantity: number; price: number }>;
}

import { ADMIN_EMAILS, BANK_INFO, PHONE_DISPLAY } from "@/lib/site";

const ONBOARDING_FROM = "Yıldırım Avize <onboarding@resend.dev>";

// RESEND_FROM (doğrulanmış alan adı) varsa onu dener; reddedilirse onboarding@resend.dev ile yeniden dener
async function sendViaResend(apiKey: string, payload: Record<string, unknown>): Promise<boolean> {
  const senders = [process.env.RESEND_FROM, ONBOARDING_FROM].filter((f, i, a): f is string => !!f && a.indexOf(f) === i);
  for (const from of senders) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, from }),
      });
      if (res.ok) return true;
      console.error("Resend reddetti:", from, await res.json().catch(() => res.status));
    } catch (err) {
      console.error("Resend bağlantı hatası:", err);
    }
  }
  return false;
}

export async function sendOrderNotificationEmails(data: EmailOrderData) {
  const apiKey = process.env.RESEND_API_KEY;

  const isBeyoglu = data.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const shippingText = isBeyoglu
    ? "📍 Mağazadan Teslim (Şişhane Merkezimiz)"
    : "📦 Adrese Teslim (Sigortalı Korumalı Koli)";

  const kargonomiBlock =
    !isBeyoglu && (data.kargonomiShipmentId || data.shippingTrackingCode || data.shippingBarcode)
      ? `
      <div style="background-color: #fffbeb; padding: 16px; border-radius: 12px; border: 1px solid #fde68a; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          🚚 Kargonomi Lojistik Kaydı
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          ${
            data.kargonomiShipmentId
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargonomi Gönderi No:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">#${data.kargonomiShipmentId}</td></tr>`
              : ""
          }
          ${
            data.shippingProviderName
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Firması:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #171717;">${data.shippingProviderName}</td></tr>`
              : ""
          }
          ${
            data.shippingTrackingCode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Takip Kodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${data.shippingTrackingCode}</td></tr>`
              : ""
          }
          ${
            data.shippingBarcode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Paket Barkodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; color: #171717;">${data.shippingBarcode}</td></tr>`
              : ""
          }
        </table>
      </div>
      `
      : "";

  const bankBlock =
    data.paymentMethod === "BANK_TRANSFER"
      ? `
      <div style="background-color: #fffbeb; padding: 16px; border-radius: 12px; border: 1px solid #fde68a; margin: 20px 0; font-size: 13px; color: #171717;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🏦 Havale / EFT Bilgileri</div>
        <div>Banka: <strong>${BANK_INFO.bank}</strong></div>
        <div>Alıcı Adı: <strong>${BANK_INFO.holder}</strong></div>
        <div>IBAN: <strong style="font-family: monospace;">${BANK_INFO.iban}</strong></div>
        <div style="margin-top: 10px; color: #b91c1c; font-weight: bold;">Lütfen havale/EFT açıklama kısmına Sipariş Numaranızı (${data.orderId}) yazmayı unutmayınız.</div>
      </div>
      `
      : "";

  // Müşteriye Gidecek Lüks HTML Fatura Şablonu
  const customerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px;">
      <h1 style="color: #171717; font-size: 26px; text-align: center; margin-bottom: 4px; letter-spacing: 1px;">YILDIRIM AVİZE</h1>
      <p style="text-align: center; color: #d97706; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 0; font-weight: bold;">Beyoğlu Şişhane Mirası</p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;" />
      
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 13px; font-weight: bold; padding: 6px 16px; border-radius: 20px; border: 1px solid #a7f3d0;">
          ✓ Siparişiniz Başarıyla Alındı
        </span>
      </div>

      <h2 style="color: #171717; font-size: 18px; margin-top: 0;">Sayın ${data.customerName},</h2>
      <p style="color: #525252; font-size: 14px; line-height: 1.6;">
        Yıldırım Avize'yi tercih ettiğiniz için teşekkür ederiz. Seçtiğiniz avizeler merkezimizde ustalarımız tarafından son kalite kontrolleri ve ışık testleri yapılmak üzere sıraya alınmıştır.
      </p>

      <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #737373;">Sipariş Kodu:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373;">Teslimat Türü:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">${shippingText}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0 6px 0; border-top: 1px solid #f5f5f5; font-size: 15px; font-weight: bold; color: #171717;">Toplam Tutar:</td>
            <td style="padding: 12px 0 6px 0; border-top: 1px solid #f5f5f5; text-align: right; font-size: 18px; font-weight: bold; color: #d97706;">${data.totalAmount.toLocaleString("tr-TR")} ₺</td>
          </tr>
        </table>
      </div>

      ${bankBlock}

      ${kargonomiBlock}

      <p style="color: #737373; font-size: 12px; line-height: 1.5; text-align: center;">
        Avizeniz hazırlandığında veya kargoya verildiğinde tarafınıza tekrar bilgilendirme yapılacaktır.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;" />

      <p style="font-size: 11px; color: #a3a3a3; text-align: center; margin: 0;">
        Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane / Beyoğlu, İstanbul | Tel: 0537 211 42 23
      </p>
    </div>
  `;

  if (apiKey) {
    await sendViaResend(apiKey, {
      to: [data.customerEmail],
      subject: `✓ Siparişiniz Alındı - #${data.orderId.slice(0, 8)}`,
      html: customerHtml,
    });
  }
}
const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const multiline = (v: string) => esc(v).replace(/\n/g, "<br />");

/** Yeni iletişim mesajı / ürün sorusu: tüm yöneticilere bildirim. */
export async function sendNewMessageEmail(data: {
  kind: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  productTitle?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const isQuestion = data.kind === "PRODUCT_QUESTION";
  return sendViaResend(apiKey, {
    to: ADMIN_EMAILS,
    reply_to: data.email,
    subject: isQuestion
      ? `Ürün Sorusu: ${data.productTitle || "Ürün"} - ${data.name}`
      : `İletişim Formu: ${data.subject || "Genel"} - ${data.name}`,
    html: `<p><strong>${esc(data.name)}</strong> (${esc(data.email)}${data.phone ? `, ${esc(data.phone)}` : ""})</p>${
      data.productTitle ? `<p>Ürün: <strong>${esc(data.productTitle)}</strong></p>` : ""
    }<p>${multiline(data.message)}</p><p style="color:#737373;font-size:12px">Yanıtlamak için yönetim panelindeki "Gelen Mesajlar & Sorular" bölümünü kullanın.</p>`,
  });
}

/** Yönetici yanıtı: müşterinin e-posta adresine gönderilir. */
export async function sendReplyEmail(data: {
  to: string;
  name: string;
  question: string;
  reply: string;
  productTitle?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  return sendViaResend(apiKey, {
    to: [data.to],
    subject: data.productTitle ? `Sorunuz yanıtlandı: ${data.productTitle}` : "Mesajınız yanıtlandı - Yıldırım Avize",
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">${multiline(data.reply)}</p>
      <div style="margin-top: 20px; padding: 12px 16px; background: #fafafa; border-left: 3px solid #d97706; font-size: 13px; color: #525252;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a3a3a3; margin-bottom: 4px;">Sizin mesajınız</div>
        ${multiline(data.question)}
      </div>
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yanıtları sitemizde Hesabım → Ürün Sorularım / Mesajlarım bölümünden de görebilirsiniz.<br />Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}
