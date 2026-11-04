import { cache } from "react";
import { prisma } from "@/lib/db";
import { LEGACY_SHOWCASE_CODE } from "@/lib/coupon-code";
import { isExpired } from "@/lib/coupon-expiry";
import type { CouponRule } from "@/lib/pricing";
import type { LadderContext } from "@/lib/price-ladder";

/**
 * Vitrin kuponunun kaydı: SiteConfig.showcaseCouponId ile kimliğe bağlıdır (kod adı değişse de aynı kupon); bağ yoksa (veya kayıt/sütun okunamazsa)
 * eski varsayılan koda (YILDIRIM5) düşer.
 */
async function findShowcaseCoupon() {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { showcaseCouponId: true } }).catch(() => null);
  if (cfg?.showcaseCouponId) {
    const bound = await prisma.coupon.findUnique({ where: { id: cfg.showcaseCouponId } });
    if (bound) return bound;
  }
  return prisma.coupon.findUnique({ where: { code: LEGACY_SHOWCASE_CODE } });
}

/** Vitrin kuponu geçerliyse kuralı döner: aktif + süresi geçmemiş + limiti dolmamış + herkese açık + tüm ürünlerde geçerli. */
export async function loadShowcaseCoupon(): Promise<CouponRule | null> {
  const coupon = await findShowcaseCoupon();
  const usable = coupon && coupon.active && !isExpired(coupon.expiresAt) && coupon.usedCount < coupon.maxUses && !coupon.userEmail && !coupon.productId;
  if (!usable) return null;
  return {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    productId: null,
    discountType: coupon.discountType === "FIXED" ? "FIXED" : "PERCENT",
    discountAmount: coupon.discountAmount,
    minCartTotal: coupon.minCartTotal,
  };
}

/** Kuponun gerçek değeri: "%5" veya "100 ₺". */
export function couponValueLabel(rule: CouponRule): string {
  return rule.discountType === "FIXED" && rule.discountAmount
    ? `${rule.discountAmount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`
    : `%${rule.discountPercent.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

/** Vitrin kuponu + üst sınır: sayfa isteği başına BİR KEZ okunur (React cache). */
export const getLadderContext = cache(async (): Promise<LadderContext> => {
  const [coupon, config] = await Promise.all([loadShowcaseCoupon(), prisma.siteConfig.findUnique({ where: { id: 1 }, select: { maxTotalDiscountPct: true } })]);
  return { maxTotalDiscountPct: config?.maxTotalDiscountPct ?? null, coupon };
});
