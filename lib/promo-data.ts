import { cache } from "react";
import { prisma } from "@/lib/db";
import { getHomepageRaw } from "@/lib/homepage";
import { getLadderContext } from "@/lib/showcase";
import { FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT } from "@/lib/pricing";
import { MAP_LINK } from "@/lib/site";
import { defaultCardsWithCode } from "@/lib/coupon-code";
import { buildPromoViews, couponCodesOf, resolvePromoCards, type CouponRow, type PromoView } from "@/lib/promo-cards";

/** Ana sayfa avantaj kartları (istek başına bir kez). Kupon kayıtları tek sorguyla, üst sınır mevcut vitrin bağlamından gelir. Hata → kart yok (sayfa bozulmaz). */
export const getPromoViews = cache(async (): Promise<PromoView[]> => {
  try {
    const ctx = await getLadderContext();
    // Kayıtlı kart yoksa varsayılan kupon kartı vitrin kuponunun güncel adını gösterir (kaydedilmiş kartlar yeniden adlandırmada güncellenir)
    const cards = defaultCardsWithCode(resolvePromoCards(await getHomepageRaw()), ctx.coupon?.code);
    const codes = couponCodesOf(cards);
    const rows = codes.length ? await prisma.coupon.findMany({ where: { code: { in: codes } } }) : [];
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
