interface EmailOrderData {
  orderId: string;
  customerName: string;
  recipientName?: string | null; // teslimat alıcı adı; yalnızca yönetici e-postasında (hesap adından farklıysa) gösterilir
  customerEmail: string;
  customerPhone?: string | null;
  orderNote?: string | null;
  invoiceType?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  companyTitle?: string | null;
  receiptPending?: boolean;
  totalAmount: number;
  shippingType: string;
  paymentMethod?: string | null;
  couponCode?: string | null;
  createdAt?: Date | null;
  address?: string | null;
  buyerCityName?: string | null; // ilçe
  buyerStateName?: string | null; // il
  kargonomiShipmentId?: number | null;
  shippingProviderName?: string | null;
  shippingTrackingCode?: string | null;
  shippingBarcode?: string | null;
  items: Array<{ title: string; variationName: string; quantity: number; price: number }>;
}

import { ADDRESS_LINE, ADMIN_EMAILS, BANK_INFO, PHONE_DISPLAY, SITE_URL } from "@/lib/site";
import { orderCode, bankPaymentDeadline, breakdownOf, breakdownRows, deliveryAddressText, formatIstanbul, formatTl, orderNotificationLink, type BreakdownRow } from "@/lib/order-display";
import { carrierDativeName, carrierTrackingLink } from "@/lib/carrier-links";
import { IADE_TALIMATI } from "@/lib/legal-texts";
import { buildLegalSummaryHtml } from "@/lib/legal-email";
import { adminOrderHref } from "@/lib/admin-order-detail";
import { recipientDiffers } from "@/lib/recipient";
import { buildQuestionReceivedHtml } from "@/lib/contact-confirm";
import { buildCampaignFooter, unsubscribeHeaders } from "@/lib/marketing";
import { productPath } from "@/lib/product-url";

const DEFAULT_FROM = "Yıldırım Avize <siparis@yildirimavize.com.tr>";
const ONBOARDING_FROM = "Yıldırım Avize <onboarding@resend.dev>";
/** Resend isteği bu süre (ms) sonunda kesilir; asılı kalan çağrı sipariş yanıtını ve bağlantı havuzunu tutmasın. */
const RESEND_TIMEOUT_MS = 8_000;
// Müşteri e-postayı yanıtladığında mesaj bu kutuya düşer
const REPLY_TO = "omeryildirim_3@hotmail.com";

/** Loglarda alıcı e-postası tam yazılmaz (KVKK): a***@alan.com */
const maskTo = (to: unknown) => (Array.isArray(to) ? to : [to]).map((t) => String(t).replace(/^(.).*@/, "$1***@"));

/** Tüm e-postaların en üstüne marka logosu (opak beyaz PNG, mutlak https adres; görsel engellenirse alt metin okunur). */
/** Tutar rengi ve düğme zemini (beyaz yazıyla ≥4.5:1; eski #d97706 ~3:1 idi). */
export const EMAIL_ORANGE = "#b45309";
export const EMAIL_LOGO_HTML = `<img src="https://www.yildirimavize.com.tr/email-logo-v3.png" width="200" alt="Yıldırım Avize" style="display:block;margin:0 auto 16px;border:0">`;

// RESEND_FROM (yoksa kurumsal varsayılan adres) ile dener; alan adı doğrulanmamışsa onboarding@resend.dev ile yeniden dener
async function sendViaResend(apiKey: string | undefined, payload: Record<string, unknown>): Promise<boolean> {
  // Silinmiş hesabın anonim adresi (silinmis-<id>@silinmis.invalid) gerçek bir posta kutusu değildir: hiç gönderilmez
  const recipients = (Array.isArray(payload.to) ? payload.to : [payload.to]).filter((t) => !String(t).trim().toLowerCase().endsWith(".invalid"));
  if (recipients.length === 0) return false;
  payload = { ...payload, to: recipients };
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
        body: JSON.stringify({ ...payload, ...(typeof payload.html === "string" ? { html: EMAIL_LOGO_HTML + payload.html } : {}), from, reply_to: REPLY_TO }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS), // zaman aşımı catch'e düşer: sıradaki gönderici denenir, en sonda false
      });
      if (res.ok) return true;
      console.error("[email] Resend reddetti:", { from, to: maskTo(payload.to), subject: payload.subject, status: res.status, body: ((await res.json().catch(() => null)) as { message?: unknown } | null)?.message ?? null });
    } catch (err) {
      console.error("[email] Resend bağlantı hatası:", { from, to: maskTo(payload.to), subject: payload.subject, err: (err as Error)?.message });
    }
  }
  return false;
}

/** Tutar dökümü satırları (lib/order-display.ts breakdownRows; /siparis-onay ile aynı liste) e-posta tablosu olarak. */
function breakdownHtml(rows: BreakdownRow[]): string {
  return rows
    .map((r) => {
      const style =
        r.kind === "total"
          ? "padding: 10px 0 4px; border-top: 1px solid #e5e5e5; font-size: 15px; font-weight: bold; color: #171717;"
          : `padding: 4px 0; color: ${r.kind === "discount" ? "#047857" : "#525252"};`;
      const valueStyle = r.kind === "total" ? `font-size: 18px; color: ${EMAIL_ORANGE};` : "";
      return `<tr><td style="${style}">${r.label}</td><td style="${style} text-align: right; white-space: nowrap; ${valueStyle}">${r.value}</td></tr>`;
    })
    .join("");
}

export async function sendOrderNotificationEmails(data: EmailOrderData) {
  const apiKey = process.env.RESEND_API_KEY;
  const isBank = data.paymentMethod === "BANK_TRANSFER";
  const totalsRows = breakdownHtml(breakdownRows(breakdownOf(data.items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })), data.shippingType, data.totalAmount)));
  const deliveryText = esc(deliveryAddressText(data, ADDRESS_LINE));
  const orderUrl = `${SITE_URL}/siparis-onay/${data.orderId}`;
  const adminOrderUrl = `${SITE_URL}${adminOrderHref(data.orderId)}`;
  const bankDeadline = isBank && data.createdAt ? formatIstanbul(bankPaymentDeadline(data.createdAt)) : null;

  const isBeyoglu = data.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const shippingText = isBeyoglu
    ? "📍 Mağazadan Teslim (Şişhane Merkezimiz)"
    : "📦 Adrese Teslim";

  const kargonomiBlock =
    !isBeyoglu && (data.kargonomiShipmentId || data.shippingTrackingCode || data.shippingBarcode)
      ? `
      <div style="background-color: #fffbeb; padding: 16px; border-radius: 12px; border: 1px solid #fde68a; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          🚚 Kargo Kaydı
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          ${
            data.kargonomiShipmentId
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Gönderi No:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">#${esc(String(data.kargonomiShipmentId))}</td></tr>`
              : ""
          }
          ${
            data.shippingProviderName
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Firması:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #171717;">${esc(data.shippingProviderName)}</td></tr>`
              : ""
          }
          ${
            data.shippingTrackingCode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Takip Kodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${esc(data.shippingTrackingCode)}</td></tr>`
              : ""
          }
          ${
            data.shippingBarcode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Paket Barkodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; color: #171717;">${esc(data.shippingBarcode)}</td></tr>`
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
        <div>Gönderilecek tutar: <strong>${formatTl(data.totalAmount)}</strong></div>
        ${bankDeadline ? `<div style="margin-top: 8px;">Son ödeme: <strong>${bankDeadline}</strong> (bu süre içinde dekont ulaşmazsa sipariş otomatik iptal edilir)</div>` : ""}
        <div style="margin-top: 10px; padding: 8px 10px; background: #fef3c7; border-left: 3px solid #b45309; color: #78350f; font-weight: bold;">Lütfen havale/EFT açıklama kısmına Sipariş Kodunuzu (${orderCode(data.orderId)}) yazmayı unutmayınız.</div>
      </div>
      `
      : "";

  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding: 6px 0; color: #171717;">${i.quantity}x ${esc(i.title)}<br /><span style="font-size: 11px; color: #737373;">${esc(i.variationName)}</span></td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717; white-space: nowrap;">${(i.price * i.quantity).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td></tr>`
    )
    .join("");
  const shortId = orderCode(data.orderId);
  const noteBlock = data.orderNote
    ? `<div style="background-color: #ffffff; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 0 0 25px 0; font-size: 13px; color: #171717;"><div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Sipariş Notunuz</div>${multiline(data.orderNote)}</div>`
    : "";
  const invoiceText =
    data.invoiceType === "CORPORATE"
      ? `Kurumsal — ${esc(data.companyTitle || "-")} / VD: ${esc(data.taxOffice || "-")} / VKN: ${esc(data.taxNumber || "-")}`
      : `Bireysel${data.taxNumber ? ` — T.C. ${esc(data.taxNumber)}` : ""}`;
  const adminNoteBlock = data.orderNote
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 14px;"><strong>📝 SİPARİŞ NOTU (zincir / kablo / bakla / montaj):</strong><br />${multiline(data.orderNote)}</div>`
    : "";

  // Müşteriye Gidecek Lüks HTML Fatura Şablonu
  const customerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px;">
      <h1 style="color: #171717; font-size: 26px; text-align: center; margin-bottom: 4px; letter-spacing: 1px;">YILDIRIM AVİZE</h1>
      <p style="text-align: center; color: ${EMAIL_ORANGE}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 0; font-weight: bold;">Beyoğlu Şişhane Mirası</p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;" />
      
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 13px; font-weight: bold; padding: 6px 16px; border-radius: 20px; border: 1px solid #a7f3d0;">
          ✓ Siparişiniz Başarıyla Alındı
        </span>
      </div>

      <h2 style="color: #171717; font-size: 18px; margin-top: 0;">Sayın ${esc(data.customerName)},</h2>
      <p style="color: #525252; font-size: 14px; line-height: 1.6;">
        ${
          isBank
            ? "Yıldırım Avize'yi tercih ettiğiniz için teşekkür ederiz. Ödemeniz bekleniyor. Havale/EFT açıklamasına sipariş kodunuzu yazın; ödemeniz onaylandığında siparişiniz hazırlanacaktır."
            : "Yıldırım Avize'yi tercih ettiğiniz için teşekkür ederiz. Seçtiğiniz avizeler merkezimizde ustalarımız tarafından son kalite kontrolleri ve ışık testleri yapılmak üzere sıraya alınmıştır."
        }
      </p>

      <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #737373;">Sipariş Kodu:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">${shortId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373;">Teslimat Türü:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">${shippingText}</td>
          </tr>
        </table>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f5f5f5; font-size: 13px;">
          <div style="color: #737373;">Teslimat Adresi:</div>
          <div style="color: #171717; font-weight: 600; margin-top: 2px;">${deliveryText}</div>
        </div>
      </div>

      <div style="background-color: #ffffff; padding: 16px 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 0 0 25px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Ürünleriniz</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${itemRows}</table>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; border-top: 1px solid #f5f5f5;">${totalsRows}</table>
      </div>

      <p style="text-align: center; margin: 0 0 25px 0;"><a href="${orderUrl}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">Siparişi görüntüle</a></p>

      ${noteBlock}

      ${bankBlock}

      ${kargonomiBlock}

      ${buildLegalSummaryHtml(SITE_URL)}

      <p style="color: #737373; font-size: 12px; line-height: 1.5; text-align: center;">
        Avizeniz kargoya verildiğinde tarafınıza tekrar bilgilendirme yapılacaktır.
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
        <tr><td style="padding: 4px 0; color: #737373;">Sipariş Kodu</td><td style="padding: 4px 0; text-align: right; font-family: monospace;">${shortId}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Müşteri</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">${esc(data.customerName)}</td></tr>
        ${recipientDiffers({ recipientName: data.recipientName, user: { name: data.customerName } }) ? `<tr><td style="padding: 4px 0; color: #737373;">Alıcı</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">${esc(String(data.recipientName).trim())}</td></tr>` : ""}
        <tr><td style="padding: 4px 0; color: #737373;">E-posta</td><td style="padding: 4px 0; text-align: right;">${esc(data.customerEmail)}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Telefon</td><td style="padding: 4px 0; text-align: right;">${esc(data.customerPhone || "-")}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Teslimat</td><td style="padding: 4px 0; text-align: right;">${isBeyoglu ? "Mağazadan Teslim" : "Adrese Teslim"}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373; vertical-align: top;">Teslimat Adresi</td><td style="padding: 4px 0; text-align: right;">${deliveryText}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Ödeme</td><td style="padding: 4px 0; text-align: right;">${isBank ? "Havale / EFT (onay bekliyor)" : "Kredi Kartı"}</td></tr>
        <tr><td style="padding: 4px 0; color: #737373;">Fatura</td><td style="padding: 4px 0; text-align: right;">${invoiceText}</td></tr>
      </table>
      ${adminNoteBlock}
      <h3 style="margin: 20px 0 6px; font-size: 14px;">Ürünler</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${itemRows}</table>
      <h3 style="margin: 20px 0 6px; font-size: 14px;">Tutar Dökümü</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${totalsRows}${data.couponCode ? `<tr><td style="padding: 4px 0; color: #737373;">Kupon</td><td style="padding: 4px 0; text-align: right; font-family: monospace;">${esc(data.couponCode)}</td></tr>` : ""}</table>
      <p style="margin-top: 20px;"><a href="${adminOrderUrl}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; padding: 10px 22px; border-radius: 10px;">Siparişi panelde aç</a></p>
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

/** Soru / mesaj gönderen müşteriye otomatik teyit (mesaj metni ve ad içermez). */
export async function sendQuestionReceivedEmail(data: { to: string; productTitle?: string | null }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: "Sorunuz Bize Ulaştı - Yıldırım Avize",
    html: buildQuestionReceivedHtml(PHONE_DISPLAY, data.productTitle),
  });
}

const DELETION_WRAP = (body: string) => `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">${body}
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`;

/** Hesap silme talebi alındı teyidi (talep yönetici onayına gider). */
export async function sendAccountDeletionRequestedEmail(data: { to: string; name: string }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: "Hesap Silme Talebiniz Alındı - Yıldırım Avize",
    html: DELETION_WRAP(`<h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hesabınızın silinmesi talebiniz bize ulaştı ve incelemeye alındı. Tamamlanmamış siparişiniz varsa bunlar kapanana kadar silme işlemi yapılamaz.</p>
      <p style="font-size: 14px; line-height: 1.6;">Talebinizden vazgeçerseniz Hesabım sayfasından geri çekebilirsiniz. İşlem tamamlandığında size ayrıca bilgi vereceğiz.</p>`),
  });
}

/** Hesap silindi bildirimi: anonimleştirmeden ÖNCE okunan gerçek adrese gönderilir. */
export async function sendAccountDeletedEmail(data: { to: string; name: string }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: "Hesabınız Silindi - Yıldırım Avize",
    html: DELETION_WRAP(`<h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Talebiniz üzerine hesabınız silindi. Adres, favori, sepet, yorum ve mesaj kayıtlarınız kaldırıldı; e-posta bildirimleri kapatıldı.</p>
      <p style="font-size: 14px; line-height: 1.6;">Geçmiş siparişleriniz ve faturalarınız, yasal saklama yükümlülükleri gereği anonimleştirilmiş hesapla süresi boyunca saklanır.</p>`),
  });
}

/** Yeni ürün yorumunu yöneticilere bildirir. */
export async function sendReviewAdminEmail(data: { productTitle: string; productId: string; rating: number; comment: string; name: string; email: string }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: ADMIN_EMAILS,
    subject: `Yeni Ürün Yorumu: ${data.productTitle} - ${data.rating} Yıldız`,
    html: `<p><strong>${esc(data.name)}</strong> (${esc(data.email)}) <strong>${esc(data.productTitle)}</strong> ürününe ${"★".repeat(data.rating)}${"☆".repeat(5 - data.rating)} verdi.</p>
      <p>${multiline(data.comment)}</p>
      <p><a href="${SITE_URL}${productPath({ id: data.productId, title: data.productTitle })}#yorumlar">Ürün sayfasında gör</a></p>`,
  });
}

const CODE_COPY: Record<string, { subject: string; lead: string }> = {
  REGISTER: { subject: "Kayıt Doğrulama Kodunuz", lead: "Yıldırım Avize hesabınızı oluşturmak için doğrulama kodunuz:" },
  RESET_PASSWORD: { subject: "Şifre Sıfırlama Kodunuz", lead: "Şifrenizi sıfırlamak için doğrulama kodunuz:" },
  CHANGE_PASSWORD: { subject: "Şifre Değiştirme Kodunuz", lead: "Şifrenizi değiştirmek için doğrulama kodunuz:" },
  TWO_FACTOR_ENABLE: { subject: "İki Aşamalı Doğrulama Onay Kodunuz", lead: "İki aşamalı doğrulamayı etkinleştirmek için onay kodunuz:" },
  TWO_FACTOR_DISABLE: { subject: "İki Aşamalı Doğrulamayı Kapatma Kodunuz", lead: "İki aşamalı doğrulamayı kapatmak için onay kodunuz:" },
  TWO_FACTOR_LOGIN: { subject: "Giriş Doğrulama Kodunuz", lead: "Hesabınıza giriş yapmak için doğrulama kodunuz:" },
  ADMIN_LOGIN: { subject: "Yönetici Girişi Doğrulama Kodunuz", lead: "Yönetim paneline giriş yapmak için doğrulama kodunuz:" },
  ADMIN_PASSWORD: { subject: "Yönetici Şifre Değiştirme Kodunuz", lead: "Yönetici şifrenizi değiştirmek için doğrulama kodunuz:" },
};

/** 6 haneli e-posta doğrulama kodu (kurumsal şablon). */
export async function sendVerificationCodeEmail(data: { to: string; code: string; type: string }) {
  const copy = CODE_COPY[data.type] ?? CODE_COPY.REGISTER;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `${copy.subject} - Yıldırım Avize`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0;">YILDIRIM AVİZE</h1>
      <p style="text-align: center; color: ${EMAIL_ORANGE}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; margin: 4px 0 20px;">Beyoğlu Şişhane Mirası</p>
      <p style="font-size: 14px; line-height: 1.6;">${copy.lead}</p>
      <div style="text-align: center; margin: 22px 0;"><span style="display: inline-block; font-family: monospace; font-size: 34px; font-weight: bold; letter-spacing: 8px; background: #ffffff; border: 2px dashed #d97706; border-radius: 12px; padding: 14px 24px; color: #92400e;">${data.code}</span></div>
      <p style="font-size: 12px; color: #b91c1c; text-align: center; font-weight: bold;">Bu kod 10 dakika süreyle geçerlidir. Güvenliğiniz için kimseyle paylaşmayınız.</p>
      <p style="font-size: 11px; color: #a3a3a3; text-align: center; margin-top: 18px;">Bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayınız.</p>
    </div>`,
  });
}

/** Yönetici şifresi değişince hesap sahibine bilgi (şifre veya kod içermez). */
export async function sendPasswordChangedEmail(to: string) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [to],
    subject: "Şifreniz değiştirildi - Yıldırım Avize",
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <p style="font-size: 14px; line-height: 1.6;">Yönetici hesabınızın şifresi değiştirildi ve tüm yönetici oturumları kapatıldı.</p>
      <p style="font-size: 12px; color: #b91c1c; font-weight: bold;">Bu işlemi siz yapmadıysanız hemen bizimle iletişime geçin.</p>
    </div>`,
  });
}

/** Terk edilen ödeme denemesi için KAMPANYA sürümü (vitrin kuponunun gerçek değeriyle). Yalnızca ticari ileti onayı olanlara gönderilir; footerHtml (unvan, adres, çıkış bağlantısı) zorunludur. */
export async function sendAbandonedCartEmail(data: { to: string; name: string; orderId: string; items: { title: string; quantity: number }[]; couponCode: string; discountLabel: string; footerHtml: string }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    headers: unsubscribeHeaders(data.to),
    subject: `Sepetinizdeki avize sizi bekliyor! Sepetinizi tamamlarken kullanabileceğiniz ${data.discountLabel} indirim kodu: ${data.couponCode}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Sepetinizdeki avize sizi bekliyor! Sepetinizi tamamlarken kullanabileceğiniz <strong>${esc(data.discountLabel)} indirim</strong> kodu:</p>
      <p style="text-align: center; margin: 18px 0;"><span style="display: inline-block; font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 3px; background: #fffbeb; border: 1px dashed #d97706; border-radius: 10px; padding: 10px 22px; color: #92400e;">${esc(data.couponCode)}</span></p>
      <ul style="font-size: 13px; color: #525252; padding-left: 18px;">${data.items.map((i) => `<li>${i.quantity}x ${esc(i.title)}</li>`).join("")}</ul>
      <p style="text-align: center; margin: 22px 0 8px;"><a href="${SITE_URL}/sepet" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">Siparişimi Tamamla</a></p>
      <p style="font-size: 12px; color: #737373; text-align: center;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
      ${data.footerHtml}
    </div>`,
  });
}

/** Terk edilen ödeme denemesi için SADE hatırlatma: indirim, kupon veya özendirici ifade içermez (onayı olmayanlara gider). */
export async function sendCartReminderEmail(data: { to: string; name: string; items: { title: string; quantity: number }[] }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: "Siparişiniz tamamlanmadı - Yıldırım Avize",
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Sitemizde başlattığınız sipariş işlemi tamamlanmadı. Sepetinizde aşağıdaki ürünler bulunmaktadır:</p>
      <ul style="font-size: 13px; color: #525252; padding-left: 18px;">${data.items.map((i) => `<li>${i.quantity}x ${esc(i.title)}</li>`).join("")}</ul>
      <p style="text-align: center; margin: 22px 0 8px;"><a href="${SITE_URL}/sepet" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">Sepetime Dön</a></p>
      <p style="font-size: 13px; line-height: 1.6; color: #525252; text-align: center;">Sorularınız için WhatsApp destek hattımızdan (${PHONE_DISPLAY}) bize ulaşabilirsiniz.</p>
      <p style="font-size: 12px; color: #737373; text-align: center;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

/** Müşteriye özel kupon e-postası, KAMPANYA sürümü: zorunlu alt bilgi ve çıkış bağlantısı içerir (yalnızca ticari ileti onayı olanlara). */
export async function sendCampaignCouponEmail(data: { to: string; name: string; code: string; discountPercent: number; discountAmount?: number | null; footerHtml: string }) {
  const label = data.discountAmount ? `${data.discountAmount.toLocaleString("tr-TR")} ₺` : `%${data.discountPercent}`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    headers: unsubscribeHeaders(data.to),
    subject: `Size özel ${label} indirim kuponu - Yıldırım Avize`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Size özel <strong>${label}</strong> indirim kuponu tanımlandı!</p>
      <p style="text-align: center; margin: 20px 0;"><span style="display: inline-block; white-space: nowrap; user-select: all; -webkit-user-select: all; font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; background: #fffbeb; border: 1px dashed #d97706; border-radius: 10px; padding: 10px 20px; color: #92400e;">${esc(data.code)}</span></p>
      <p style="font-size: 12px; color: #737373;">Kuponu sepet sayfasında kullanabilir, Hesabım → Kuponlarım bölümünden de görebilirsiniz.<br />Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
      ${data.footerHtml}
    </div>`,
  });
}

/** Havale yapıp dekont yüklemeyen müşteriye hatırlatma. */
export async function sendReceiptReminderEmail(data: { to: string; name: string; orderId: string }) {
  const url = `${SITE_URL}/siparis-onay/${data.orderId}`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `Havale dekontunuzu bekliyoruz - #${orderCode(data.orderId)}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Siparişinizin onaylanması için havale dekontunuzu bekliyoruz. Aşağıdaki bağlantıdan dekontunuzu yükleyebilir veya sipariş detaylarını görebilirsiniz.</p>
      <p style="text-align: center; margin: 22px 0 8px;"><a href="${url}" style="display: inline-block; background: ${EMAIL_ORANGE}; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">Dekontumu Yükle</a></p>
      <p style="font-size: 12px; color: #737373; text-align: center;">Sipariş Kodu: ${orderCode(data.orderId)}<br />Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

/** Süresi içinde ödenmeyen Havale siparişi otomatik iptal edilince müşteriye bilgi. */
export async function sendBankOrderCancelledEmail(data: { to: string; name: string; orderId: string; hours: number }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `Havale siparişiniz iptal edildi - #${orderCode(data.orderId)}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Havale/EFT siparişiniz için ${data.hours} saat içinde ödeme dekontu ulaşmadığından siparişiniz iptal edildi ve ürünler yeniden satışa açıldı.</p>
      <p style="font-size: 14px; line-height: 1.6;">Ödemeyi yaptıysanız lütfen dekontunuzla bizimle iletişime geçin; siparişiniz için size yardımcı olalım.</p>
      <p style="font-size: 12px; color: #737373; text-align: center;">Sipariş Kodu: ${orderCode(data.orderId)}<br />Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

/** Müşteri dekont yükleyince yöneticilere bildirim. */
export async function sendReceiptUploadedAdminEmail(data: { orderId: string; senderName: string; customerName: string; totalAmount: number }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: ADMIN_EMAILS,
    subject: `Dekont Yüklendi: #${orderCode(data.orderId)} - ${data.customerName}`,
    html: `<p><strong>${esc(data.customerName)}</strong> havale dekontu yükledi.</p>
      <p>Gönderici: <strong>${esc(data.senderName)}</strong><br />Tutar: <strong>${data.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</strong><br />Sipariş Kodu: <code>${orderCode(data.orderId)}</code></p>
      <p><a href="${SITE_URL}${adminOrderHref(data.orderId)}">Yönetim panelinde incele ve ödemeyi onayla</a></p>`,
  });
}

/** Ödemesi alınan siparişte stok yetmediğinde yöneticilere uyarı. */
export async function sendStockShortageEmail(data: { orderId: string; items: { product: string; color: string; quantity: number }[] }) {
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: ADMIN_EMAILS,
    subject: `Stok yetersiz: #${orderCode(data.orderId)}`,
    html: `<p>Ödemesi alınan siparişte stok yetersiz kaldı; stok 0'a çekildi. Siparişi kontrol edip müşteriyle iletişime geçin.</p>
      <p>Sipariş Kodu: <code>${orderCode(data.orderId)}</code></p>
      <ul>${data.items.map((i) => `<li>${esc(i.product)} — ${esc(i.color)} — ${i.quantity} adet</li>`).join("")}</ul>`,
  });
}

/** Geç PayTR "success" (sipariş artık ödeme beklemiyor) için yöneticilere uyarı. Konu/gövde lib/late-payment.ts'te üretilir. */
export async function sendLatePaymentAdminEmail(data: { subject: string; html: string }) {
  return sendViaResend(process.env.RESEND_API_KEY, { to: ADMIN_EMAILS, subject: data.subject, html: data.html });
}

const REQUEST_LABEL: Record<string, string> = { CANCEL: "İptal", RETURN: "İade" };

/** Müşteri iptal/iade talebi açınca yöneticilere bildirim. */
export async function sendRequestAdminEmail(data: { type: string; orderId: string; customerName: string; customerEmail: string; reason?: string }) {
  const label = REQUEST_LABEL[data.type] ?? data.type;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: ADMIN_EMAILS,
    subject: `${label} Talebi: #${orderCode(data.orderId)} - ${data.customerName}`,
    html: `<p><strong>${esc(data.customerName)}</strong> (${esc(data.customerEmail)}) <strong>${label.toLowerCase()} talebi</strong> oluşturdu.</p>
      <p>Sipariş Kodu: <code>${orderCode(data.orderId)}</code></p>
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
    subject: `${result} - #${orderCode(data.orderId)}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 15px; font-weight: bold; color: ${data.approved ? "#059669" : "#b91c1c"};">${result}.</p>
      <p style="font-size: 13px; color: #525252;">Sipariş Kodu: ${orderCode(data.orderId)}</p>
      ${data.note ? `<p style="font-size: 14px;">${multiline(data.note)}</p>` : ""}
      ${
        data.approved && data.type === "RETURN"
          ? `<div style="margin: 16px 0; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 14px; line-height: 1.6;"><strong>İade talimatı:</strong> ${esc(IADE_TALIMATI)}</div>`
          : ""
      }
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

/** Sipariş kargoya verilince müşteriye takip numarası ve canlı takip bağlantısı. */
export async function sendShippedEmail(data: { to: string; name: string; orderId: string; carrier: string; trackingNumber: string; trackingKind?: "code" | "barcode" }) {
  const track = carrierTrackingLink({ providerName: data.carrier, code: data.trackingNumber });
  const live = track.href;
  const to = carrierDativeName(data.carrier);
  const codeLabel = data.trackingKind === "barcode" ? "Gönderi barkodu" : "Takip No";
  const orderUrl = `${SITE_URL}${orderNotificationLink(data.orderId)}`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `Siparişiniz ${to} Verildi - ${codeLabel}: ${data.trackingNumber}`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;"><strong>#${esc(orderCode(data.orderId))}</strong> numaralı siparişiniz korumalı kolide <strong>${to}</strong> teslim edildi.</p>
      <p style="text-align: center; margin: 18px 0 6px; font-size: 12px; color: #525252;">${codeLabel}</p>
      <p style="text-align: center; margin: 0 0 18px;"><span style="display: inline-block; white-space: nowrap; user-select: all; -webkit-user-select: all; font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; background: #ffffff; border: 2px dashed #b45309; border-radius: 10px; padding: 10px 20px; color: #92400e;">${esc(data.trackingNumber)}</span></p>
      <p style="text-align: center; font-size: 13px; color: #525252; margin: 0 0 14px;">Sipariş kodu: <strong style="font-family: monospace; color: #171717;">${esc(orderCode(data.orderId))}</strong> · <a href="${esc(orderUrl)}" style="color: #92400e; font-weight: bold;">Siparişi görüntüle</a></p>
      ${live ? `<p style="text-align: center; margin: 22px 0 8px;"><a href="${esc(live)}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">${esc(track.queryLabel.replace(/ ↗$/, ""))}</a></p>${track.hint ? `<p style="font-size: 12px; color: #525252; text-align: center; margin: 0 0 12px;">${esc(track.hint)}</p>` : ""}` : ""}
      <p style="font-size: 12px; color: #737373; text-align: center;">Yıldırım Avize | Tel: ${PHONE_DISPLAY}</p>
    </div>`,
  });
}

/** Teslim edilen siparişin PDF faturası (e-postaya EK olarak; indirme bağlantısı verilmez). */
export async function sendInvoiceEmail(data: { to: string; name: string; orderId: string; fileName: string; pdf: Buffer }) {
  const no = `#${orderCode(data.orderId)}`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    subject: `Yıldırım Avize | ${no} numaralı siparişinizin faturası`,
    attachments: [{ filename: data.fileName, content: data.pdf.toString("base64") }],
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <p style="font-size: 14px; line-height: 1.6;">Merhaba ${esc(data.name)},</p>
      <p style="font-size: 14px; line-height: 1.6;"><strong>${no}</strong> numaralı siparişinize ait faturanız bu e-postanın ekinde yer almaktadır. Bizi tercih ettiğiniz için teşekkür ederiz.</p>
      <p style="font-size: 14px; line-height: 1.6;">Ürününüzle ilgili bir sorunuz olursa WhatsApp destek hattımızdan (${PHONE_DISPLAY}) bize ulaşabilirsiniz.</p>
      <p style="font-size: 14px; line-height: 1.6; margin-top: 20px;">Saygılarımızla,<br />Yıldırım Avize</p>
    </div>`,
  });
}

/** Favori ürün fiyat düşüşü (kampanya sınıfı ileti): yalnızca ticari ileti onayı olanlara; alt bilgi ve List-Unsubscribe zorunlu. */
export async function sendPriceDropEmail(data: { to: string; name: string; productId: string; title: string; oldPrice: number; newPrice: number }) {
  const footerHtml = await buildCampaignFooter(data.to);
  if (!footerHtml) return false; // çıkış bağlantısı üretilemiyorsa kampanya e-postası gönderilmez
  const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  const url = `${SITE_URL}${productPath({ id: data.productId, title: data.title })}`;
  return sendViaResend(process.env.RESEND_API_KEY, {
    to: [data.to],
    headers: unsubscribeHeaders(data.to),
    subject: "Favorinizdeki ürünün fiyatı düştü",
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px; color: #171717;">
      <h1 style="text-align: center; font-size: 22px; letter-spacing: 1px; margin: 0 0 16px;">YILDIRIM AVİZE</h1>
      <h2 style="font-size: 17px; margin: 0 0 10px;">Sayın ${esc(data.name)},</h2>
      <p style="font-size: 14px; line-height: 1.6;">Favorilerinizdeki <strong>${esc(data.title)}</strong> ürününün fiyatı düştü:</p>
      <p style="font-size: 16px; margin: 14px 0;"><span style="text-decoration: line-through; color: #737373;">${tl(data.oldPrice)}</span> &rarr; <strong style="color: #92400e;">${tl(data.newPrice)}</strong></p>
      <p style="text-align: center; margin: 22px 0 8px;"><a href="${url}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px;">Ürünü İncele</a></p>
      ${footerHtml}
    </div>`,
  });
}
