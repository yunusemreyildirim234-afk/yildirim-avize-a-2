import { cache } from "react";
import { prisma } from "@/lib/db";
import { SHOWCASE_COUPON_CODE } from "@/lib/site";
import type { LadderContext } from "@/lib/price-ladder";

/** Vitrin kuponu + üst sınır: sayfa isteği başına BİR KEZ okunur (React cache). */
export const getLadderContext = cache(async (): Promise<LadderContext> => {
  const [coupon, config] = await Promise.all([
    prisma.coupon.findUnique({ where: { code: SHOWCASE_COUPON_CODE } }),
    prisma.siteConfig.findUnique({ where: { id: 1 }, select: { maxTotalDiscountPct: true } }),
  ]);
  // Kuponda bitiş tarihi alanı yok; aktif + limit + herkese açık + tüm ürünlerde geçerli olmalı
  const usable = coupon && coupon.active && coupon.usedCount < coupon.maxUses && !coupon.userEmail && !coupon.productId;
  return {
    maxTotalDiscountPct: config?.maxTotalDiscountPct ?? null,
    coupon: usable
      ? {
          code: coupon.code,
          discountPercent: coupon.discountPercent,
          productId: null,
          discountType: coupon.discountType === "FIXED" ? "FIXED" : "PERCENT",
          discountAmount: coupon.discountAmount,
          minCartTotal: coupon.minCartTotal,
        }
      : null,
  };
});
