import { cache } from "react";
import { prisma } from "@/lib/db";
import { SHOWCASE_COUPON_CODE } from "@/lib/site";
import { isExpired } from "@/lib/coupon-expiry";
import type { CouponRule } from "@/lib/pricing";
import type { LadderContext } from "@/lib/price-ladder";

/** Vitrin kuponu geçerliyse kuralı döner: aktif + süresi geçmemiş + limiti dolmamış + herkese açık + tüm ürünlerde geçerli. */
export async function loadShowcaseCoupon(): Promise<CouponRule | null> {
  const coupon = await prisma.coupon.findUnique({ where: { code: SHOWCASE_COUPON_CODE } });
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
