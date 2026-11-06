import { prisma } from "@/lib/db";
import { normalizeEmail, signUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { getCompanyInfo, toPublicCompany } from "@/lib/company";
import { ADDRESS_LINE, PHONE_DISPLAY, SITE_URL } from "@/lib/site";
import { LEGAL_UPDATED } from "@/lib/legal-texts";

// Ticari elektronik ileti (kampanya e-postası) onayı.
// KRİTİK: MarketingConsent tablosu canlı veritabanında henüz oluşturulmamış olabilir. Bu tabloya dokunan HER sorgu
// try/catch içindedir; hata halinde "onay yok" varsayılır ve çağıran akış (sepet, sipariş, cron) kesintisiz sürer.

export { normalizeEmail, signUnsubscribeToken, verifyUnsubscribeToken };

/**
 * E-posta başlıkları (RFC 8058): Gmail/Apple Mail "Abonelikten çık" düğmesi için List-Unsubscribe + tek tıkla POST.
 * Belirteç üretilemezse boş döner (e-posta başlıksız gider).
 */
export function unsubscribeHeaders(email: string): Record<string, string> {
  try {
    return {
      "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?t=${signUnsubscribeToken(email)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  } catch {
    return {};
  }
}

/** Geçerli (geri alınmamış) ticari ileti onayı var mı? Tablo yoksa veya herhangi bir hata olursa false. */
export async function hasActiveConsent(email: string): Promise<boolean> {
  try {
    const row = await prisma.marketingConsent.findUnique({ where: { email: normalizeEmail(email) }, select: { unsubscribedAt: true } });
    return Boolean(row) && !row?.unsubscribedAt;
  } catch (e) {
    console.error("[marketing] onay sorgulanamadı (onay yok varsayıldı):", (e as Error).message);
    return false;
  }
}

/** Açık rıza kaydı (yeniden onayda önceki çıkış kaydı temizlenir). Hata halinde false döner, asla fırlatmaz. */
export async function recordConsent(opts: { email: string; ip?: string | null; userAgent?: string | null; source?: string }): Promise<boolean> {
  try {
    const email = normalizeEmail(opts.email);
    const now = new Date();
    const meta = { textVersion: LEGAL_UPDATED, ip: opts.ip?.slice(0, 64) ?? null, userAgent: opts.userAgent?.slice(0, 300) ?? null };
    await prisma.marketingConsent.upsert({
      where: { email },
      create: { email, consentedAt: now, source: opts.source ?? "sepet", ...meta },
      update: { consentedAt: now, unsubscribedAt: null, ...meta },
    });
    return true;
  } catch (e) {
    console.error("[marketing] onay kaydedilemedi:", (e as Error).message);
    return false;
  }
}

/** Abonelikten çıkarır. Kayıt yoksa da başarılı sayılır (zaten onay yok). Veritabanı hatasında false. */
export async function unsubscribe(email: string): Promise<boolean> {
  try {
    await prisma.marketingConsent.updateMany({ where: { email: normalizeEmail(email), unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
    return true;
  } catch (e) {
    console.error("[marketing] abonelikten çıkış kaydedilemedi:", (e as Error).message);
    return false;
  }
}

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/**
 * Kampanya e-postalarının zorunlu alt bilgisi: gönderen unvanı, adresi, telefonu, onay ibaresi ve tek tıkla çıkış bağlantısı.
 * Belirteç üretilemezse (ör. gizli anahtar yok) null döner; çağıran kampanya yerine sade e-posta göndermelidir.
 */
export async function buildCampaignFooter(email: string): Promise<string | null> {
  let url: string;
  try {
    url = `${SITE_URL}/abonelik-iptal?t=${signUnsubscribeToken(email)}`;
  } catch {
    return null;
  }
  let title = "Yıldırım Avize";
  let address = ADDRESS_LINE;
  try {
    const c = toPublicCompany(await getCompanyInfo());
    title = c.title || title;
    address = c.address || address;
  } catch {
    // kurumsal bilgi okunamazsa varsayılan unvan ve adres kullanılır
  }
  return `<div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e5e5; font-size: 11px; line-height: 1.6; color: #737373; text-align: center;">
      <p style="margin: 0 0 6px;">Bu e-postayı ticari ileti onayı verdiğiniz için almaktasınız.</p>
      <p style="margin: 0 0 6px;">${esc(title)} • ${esc(address)} • Tel: ${PHONE_DISPLAY}</p>
      <p style="margin: 0;"><a href="${url}" style="color: #737373; text-decoration: underline;">Bildirimleri kapat</a></p>
    </div>`;
}
