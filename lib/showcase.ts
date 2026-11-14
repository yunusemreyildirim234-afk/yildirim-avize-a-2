import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { LEGACY_SHOWCASE_CODE } from "@/lib/coupon-code";
import { isExpired } from "@/lib/coupon-expiry";
import type { CouponRule } from "@/lib/pricing";
import type { LadderContext } from "@/lib/price-ladder";

/**
 * Vitrin kuponunun kaydı: SiteConfig.showcaseCouponId ile kimliğe bağlıdır (kod adı değişse de aynı kupon); bağ yoksa (veya kayıt/sütun okunamazsa)
 * eski varsayılan koda (YILDIRIM5) düşer.
 */
async function findShowcaseCoupon(boundId?: string | null) {
  if (boundId) {
    const bound = await prisma.coupon.findUnique({ where: { id: boundId } });
    if (bound) return bound;
  }
  return prisma.coupon.findUnique({ where: { code: LEGACY_SHOWCASE_CODE } });
}

/** Vitrin kuponu geçerliyse kuralı döner: aktif + süresi geçmemiş + limiti dolmamış + herkese açık + tüm ürünlerde geçerli. */
export async function loadShowcaseCoupon(): Promise<CouponRule | null> {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { showcaseCouponId: true } }).catch(() => null);
  return couponRule(await findShowcaseCoupon(cfg?.showcaseCouponId));
}

function couponRule(coupon: Awaited<ReturnType<typeof findShowcaseCoupon>>): CouponRule | null {
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

/** Vitrin kuponu + üst sınır: TEK SiteConfig select'i ile okunur (önbelleksiz, taze). */
async function readLadderContext(): Promise<LadderContext> {
  const config = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { showcaseCouponId: true, maxTotalDiscountPct: true } });
  return { maxTotalDiscountPct: config?.maxTotalDiscountPct ?? null, coupon: couponRule(await findShowcaseCoupon(config?.showcaseCouponId)) };
}

/** SEPET / SİPARİŞ / fiyat teklifi yolu: ASLA veri önbelleğine girmez; sayfa isteği başına bir kez (React cache) taze okunur. */
export const getLadderContextFresh = cache(readLadderContext);

const cachedLadderContext = unstable_cache(readLadderContext, ["sf-ladder-context"], { revalidate: 60, tags: ["storefront"] });

/** VİTRİN (ürün/kategori/arama/kartlar) için: 60 sn veri önbelleği, "storefront" etiketi (kupon/indirim üst sınırı kaydı revalidateStorefront ile geçersiz kılar). Fiyat hesabına giden yollar getLadderContextFresh kullanır. */
export const getLadderContext = cache(async (): Promise<LadderContext> => cachedLadderContext());
