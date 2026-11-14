/** Aynı e-postaya 24 saatte gönderilebilecek en çok iletişim onay e-postası (bu sayıya kayıt altındaki yeni mesaj dahil). */
export const CONTACT_CONFIRM_DAILY_LIMIT = 3;

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Onay e-postası gövdesi: oturumsuz istemciden gelen ad ve mesaj metni üçüncü kişinin posta kutusuna yazılmaz; mesaj yalnız yöneticiye gider. */
export function buildQuestionReceivedHtml(phoneDisplay: string, productTitle?: string | null): string {
  return `<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="margin: 0 0 12px;">Mesajınız alındı</h2>
      <p style="font-size: 14px; line-height: 1.6;">Sorunuz ekibimize ulaşmıştır. En kısa sürede e-posta adresiniz üzerinden yanıtlanacaktır.</p>
      ${productTitle ? `<p style="font-size: 13px;">Ürün: <strong>${esc(productTitle)}</strong></p>` : ""}
      <p style="font-size: 12px; color: #737373; margin-top: 24px;">Yıldırım Avize | Tel: ${phoneDisplay}</p>
    </div>`;
}
