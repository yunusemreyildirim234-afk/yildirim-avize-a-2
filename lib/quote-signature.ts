import { EMAIL_RE } from "./validation.ts";

/**
 * Sepet teklifi (/api/cart/quote) imzası: değişince yeni teklif istenir. E-posta imzaya YALNIZ kupon uygulanmışken veya açık kartlı ödeme denemesi varken girer
 * (kişiye özel kupon / deneme sahipliği denetimi için) ve yalnız "kesinleşmiş" haliyle; her tuş vuruşunda istek gitmez (SAY-06).
 */
export function quoteSignature(p: { lines: [string, number][]; couponCode: string; shippingType: string; paymentMethod: string; emailRelevant: boolean; committedEmail: string; prevOrderId: string | null }): string {
  return JSON.stringify([p.lines, p.couponCode, p.shippingType, p.paymentMethod, p.emailRelevant ? p.committedEmail : "", p.prevOrderId ?? ""]);
}

/** Yazma duraksayınca (1 sn) imzaya katılabilir mi: yalnız geçerli biçimdeki e-posta. */
export const isCommittableEmail = (email: string) => EMAIL_RE.test(email.trim());

export const EMAIL_COMMIT_DELAY_MS = 1000;
