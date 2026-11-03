import { cache } from "react";
import { prisma } from "@/lib/db";
import { getHomepageRaw } from "@/lib/homepage";
import { getLadderContext } from "@/lib/showcase";
import { FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT } from "@/lib/pricing";
import { MAP_LINK } from "@/lib/site";
import { buildPromoViews, couponCodesOf, resolvePromoCards, type CouponRow, type PromoView } from "@/lib/promo-cards";

/** Ana sayfa avantaj kartları (istek başına bir kez). Kupon kayıtları tek sorguyla, üst sınır mevcut vitrin bağlamından gelir. Hata → kart yok (sayfa bozulmaz). */
export const getPromoViews = cache(async (): Promise<PromoView[]> => {
  try {
    const cards = resolvePromoCards(await getHomepageRaw());
    const codes = couponCodesOf(cards);
    const [rows, ctx] = await Promise.all([
      codes.length ? prisma.coupon.findMany({ where: { code: { in: codes } } }) : Promise.resolve([]),
      getLadderContext(),
    ]);
    const coupons: Record<string, CouponRow | undefined> = {};
    for (const r of rows) coupons[r.code.toUpperCase()] = r;
    return buildPromoViews(cards, {
      coupons,
      maxTotalDiscountPct: ctx.maxTotalDiscountPct,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      pickupPct: Math.round(PICKUP_DISCOUNT * 10000) / 100,
      mapLink: MAP_LINK,
    });
  } catch (e) {
    console.error("[avantaj-kartlari] okunamadı:", (e as Error).message);
    return [];
  }
});
