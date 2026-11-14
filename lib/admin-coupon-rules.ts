// Yönetici kupon ucu için saf kurallar (veritabanı yok; tests/admin-kupon-kurallari.test.mjs sınar).
// Doğrulama/rezervasyon çekirdeği lib/coupons.ts'tir; burada ona dokunulmaz.
import { isShowcaseCoupon } from "./coupon-code.ts";
import { EMAIL_RE } from "./validation.ts";

/** Kullanım limiti üst sınırı (yeni kayıtlar için; mevcut kuponlar etkilenmez). */
export const MAX_COUPON_USES = 10_000_000;

export const COUPON_DUPLICATE_ERROR = "Bu kod zaten mevcut.";
export const COUPON_IN_USE_ERROR = "Bu kod vitrinde veya ana sayfa kartlarında kullanılıyor. Önce vitrinden/kartlardan çıkarın veya pasife alın.";

/** Oluşturma girdisi: kullanım limiti ve (varsa) kişiye özel e-posta. Hata yoksa null. */
export function couponCreateInputError(maxUses: number, userEmail: string | null): string | null {
  if (!(maxUses >= 1)) return "Kullanım limiti en az 1 olmalı.";
  if (maxUses > MAX_COUPON_USES) return `Kullanım limiti en fazla ${MAX_COUPON_USES.toLocaleString("tr-TR")} olabilir.`;
  if (userEmail && !EMAIL_RE.test(userEmail)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

/** Kaydı oluşturur; eşzamanlı çift istekte benzersiz kod çakışması (P2002) 409'a çevrilir, diğer hatalar aynen fırlar. */
export async function createCouponSafe<T>(create: () => Promise<T>): Promise<{ status: 200; value: T } | { status: 409; error: string }> {
  try {
    return { status: 200, value: await create() };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return { status: 409, error: COUPON_DUPLICATE_ERROR };
    throw e;
  }
}

/** Ana sayfa avantaj kartlarından biri bu kodu gösteriyor mu. */
export function promoCardsUseCode(config: unknown, code: string): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const cards = (config as { promoCards?: unknown }).promoCards;
  if (!Array.isArray(cards)) return false;
  return cards.some((c) => {
    const card = c as { kind?: unknown; code?: unknown } | null;
    return !!card && card.kind === "COUPON" && typeof card.code === "string" && card.code.toUpperCase() === code.toUpperCase();
  });
}

/** Silme engeli: vitrin kuponu ya da kartlarda geçen kod. Silinebilirse null. */
export function couponDeleteBlock(coupon: { id: string; code: string }, cfg: { showcaseCouponId?: string | null; homepageConfig?: unknown } | null): string | null {
  if (isShowcaseCoupon(coupon, cfg?.showcaseCouponId)) return COUPON_IN_USE_ERROR;
  if (promoCardsUseCode(cfg?.homepageConfig, coupon.code)) return COUPON_IN_USE_ERROR;
  return null;
}
