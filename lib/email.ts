interface EmailOrderData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
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

const DEFAULT_FROM = "Yıldırım Avize <siparis@yildirimavize.com.tr>";
const ONBOARDING_FROM = "Yıldırım Avize <onboarding@resend.dev>";
// Müşteri e-postayı yanıtladığında mesaj bu kutuya düşer
const REPLY_TO = "omeryildirim_3@hotmail.com";

// RESEND_FROM (yoksa kurumsal varsayılan adres) ile dener; alan adı doğrulanmamışsa onboarding@resend.dev ile yeniden dener
async function sendViaResend(apiKey: string | undefined, payload: Record<string, unknown>): Promise<boolean> {
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY tanımlı değil; e-posta gönderilmedi:", payload.subject);
    return false;
  }
  const senders = [process.env.RESEND_FROM || DEFAULT_FROM, ONBOARDING_FROM].filter((f, i, a): f is string => !!f && a.indexOf(f) === i);
  for (const from of senders) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, from, reply_to: REPLY_TO }),
      });
      if (res.ok) return true;
      console.error("[email] Resend reddetti:", { from, to: payload.to, subject: payload.subject, status: res.status, body: await res.json().catch(() => null) });
    } catch (err) {
      console.error("[email] Resend bağlantı hatası:", { from, to: payload.to, subject: payload.subject, err });
    }
  }
  return false;
}

export async function sendOrderNotificationEmails(data: EmailOrderData) {
  const apiKey = process.env.RESEND_API_KEY;

  const isBeyoglu = data.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const shippingText = isBeyoglu
    ? "📍 Mağazadan Teslim (Şişhane Merkezimiz)"
    : "📦 Adrese Teslim";

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

  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding: 6px 0; color: #171717;">${i.quantity}x ${esc(i.title)}<br /><span style="font-size: 11px; color: #737373;">${esc(i.variationName)}</span></td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717; white-space: nowrap;">${(i.price * i.quantity).toLocaleString("tr-TR")} ₺</td></tr>`
    )
    .join("");
  const shortId = data.orderId.slice(0, 8);

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

      <h2 style="color: #171717; font-size: 18px; margin-top: 0;">Sayın ${esc(data.customerName)},</h2>
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

      <div style="background-color: #ffffff; padding: 16px 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 0 0 25px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Ürünleriniz</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${itemRows}</table>
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

  const adminHtml = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Yeni Sipariş Geldi: #${shortId}</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 4px 0; color: #737373;">Sipariş No</td><td style="padding: 4px 0; text-align: right; font-family: monospace;">${data.orderId}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Müşteri</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">${esc(data.customerName)}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">E-posta</td><td style="padding: 4px 0; text-align: right;">${esc(data.customerEmail)}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Telefon</td><td style="padding: 4px 0; text-align: right;">${esc(data.customerPhone || "-")}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Teslimat</td><td style="padding: 4px 0; text-align: right;">${isBeyoglu ? "Mağazadan Teslim" : "Adrese Teslim"}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Ödeme</td><td style="padding: 4px 0; text-align: right;">${data.paymentMethod === "BANK_TRANSFER" ? "Havale / EFT" : "Kredi Kartı"}</td></tr>
        <tr><td style="padding: 8px 0 4px; border-top: 1px solid #e5e5e5; font-weight: bold;">Tutar</td><td style="padding: 8px 0 4px; border-top: 1px solid #e5e5e5; text-align: right; font-size: 18px; font-weight: bold; color: #d97706;">${data.totalAmount.toLocaleString("tr-TR")} ₺</td></tr>
      </table>
      <h3 style="margin: 20px 0 6px; font-size: 14px;">Ürünler</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${itemRows}</table>
      <p style="color: #737373; font-size: 12px; margin-top: 20px;">Detaylar için yönetim paneline giriş yapın.</p>
    </div>
  `;

  // Yöneticiler ve müşteri: biri başarısız olsa diğeri etkilenmez
  await Promise.allSettled([
    sendViaResend(apiKey, { to: ADMIN_EMAILS, subject: `Yeni Sipariş Geldi: #${shortId}`, html: adminHtml }),
    sendViaResend(apiKey, { to: [data.customerEmail], subject: `Siparişiniz Alındı - #${shortId}`, html: customerHtml }),
  ]);
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

  const isQuestion = data.kind === "PRODUCT_QUESTION";
  return sendViaResend(apiKey, {
    to: ADMIN_EMAILS,
    subject: `Yeni Soru/Mesaj: ${isQuestion ? data.productTitle || "Ürün" : data.subject || "Genel"}`,
    html: `<p><strong>${esc(data.name)}</strong></p><p>E-posta: ${esc(data.email)}<br />Telefon: ${esc(data.phone || "-")}</p>${
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

  const sent = await sendViaResend(apiKey, {
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

  // Yöneticilere yanıtın kopyası (bilgi amaçlı)
  await sendViaResend(apiKey, {
    to: ADMIN_EMAILS,
    subject: `[Yanıt Kaydı] ${data.productTitle || "Mesaj"} → ${data.name}`,
    html: `<p>Müşteriye gönderilen yanıtın kopyası: <strong>${esc(data.name)}</strong> (${esc(data.to)})</p>
      ${data.productTitle ? `<p>Ürün: <strong>${esc(data.productTitle)}</strong></p>` : ""}
      <p style="color:#737373">Soru:</p><p>${multiline(data.question)}</p>
      <p style="color:#737373">Yanıt:</p><p>${multiline(data.reply)}</p>`,
  });

  return sent;
}

/** Soru / mesaj gönderen müşteriye otomatik teyit (sorusunun özetiyle). */
export async function sendQuestionReceivedEmail(data: { to: string; name: string; question: string; productTitle?: string | null }) {
  const summary = data.question.length > 300 ? `${data.question.slice(0, 300)}...` : data.question;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: "Sorunuz Bize Ulaştı - Yıldırım Avize",
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Sayın ${esc(data.name)}, sorunuz ekibimize ulaşmıştır. En kısa sürede e-posta adresiniz üzerinden yanıtlanacaktır.</p>
      ${data.productTitle ? `<p style="font-size: 13px;">Ürün: <strong>${esc(data.productTitle)}</strong></p>` : ""}
      <div style="margin-top: 16px; padding: 12px 16px; background: #fafafa; border-left: 3px solid #d97706; font-size: 13px; color: #525252;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a3a3a3; margin-bottom: 4px;">Sorunuzun özeti</div>
        ${multiline(summary)}
      </div>
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

const REQUEST_LABEL: Record<string, string> = { CANCEL: "İptal", RETURN: "İade" };

/** Müşteri iptal/iade talebi açınca yöneticilere bildirim. */
export async function sendRequestAdminEmail(data: { type: string; orderId: string; customerName: string; customerEmail: string; reason?: string }) {
  const label = REQUEST_LABEL[data.type] ?? data.type;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: ADMIN_EMAILS,
    subject: `${label} Talebi: #${data.orderId.slice(0, 8)} - ${data.customerName}`,
    html: `<p><strong>${esc(data.customerName)}</strong> (${esc(data.customerEmail)}) <strong>${label.toLowerCase()} talebi</strong> oluşturdu.</p>
      <p>Sipariş: <code>${data.orderId}</code></p>
      <p>Neden: ${data.reason ? multiline(data.reason) : "-"}</p>
      <p style="color:#737373;font-size:12px">Onaylamak veya reddetmek için yönetim panelindeki sipariş tablosunu kullanın.</p>`,
  });
}

/** Yönetici kararı müşteriye bildirilir. */
export async function sendRequestDecisionEmail(data: { to: string; name: string; type: string; approved: boolean; orderId: string; note?: string }) {
  const label = REQUEST_LABEL[data.type] ?? data.type;
  const result = data.approved ? `${label} talebiniz onaylandı` : `${label} talebiniz onaylanmadı`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `${result} - #${data.orderId.slice(0, 8)}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 15px; font-weight: bold; color: ${data.approved ? "#059669" : "#b91c1c"};">${result}.</p>
      <p style="font-size: 13px; color: #525252;">Sipariş: ${data.orderId}</p>
      ${data.note ? `<p style="font-size: 14px;">${multiline(data.note)}</p>` : ""}
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}
