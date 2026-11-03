import type { Prisma } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { BEST_SELLER_CACHE_SECONDS, bestSellerSince, rankProducts } from "@/lib/best-sellers-rules";

/**
 * Kart/liste için gereken alanlar (ProductCard, priceLadder, bulkTiersOf, ana sayfa havuzları).
 * description, images, brand, trendyol* ve zaman damgaları çekilmez.
 */
export const CARD_SELECT = {
  id: true,
  title: true,
  category: true,
  basePrice: true,
  listPrice: true,
  imageUrl: true,
  modelCode: true,
  bulkMinQty: true,
  bulkDiscountType: true,
  bulkDiscountValue: true,
  bulkTiers: true,
  couponAllowed: true,
  pickupDiscountPct: true,
  transferDiscountPct: true,
  variations: { select: { id: true, variationValue: true, extraPrice: true, stock: true }, orderBy: { id: "asc" } },
} satisfies Prisma.ProductSelect;

export async function getProducts(where: Prisma.ProductWhereInput = {}, take?: number, skip?: number) {
  return prisma.product.findMany({
    where: { active: true, ...where },
    select: CARD_SELECT,
    // Sayfalama (skip) kullanılırken eşit updatedAt değerlerinde sayfalar arası kayma olmasın diye id ile kararlı sıra
    orderBy: skip === undefined ? { updatedAt: "desc" } : [{ updatedAt: "desc" }, { id: "asc" }],
    take,
    skip,
  });
}

/** getProducts ile aynı koşulla (yalnızca aktif) ürün sayısı. */
export function countProducts(where: Prisma.ProductWhereInput = {}) {
  return prisma.product.count({ where: { active: true, ...where } });
}

// ---- Veri düzeyinde 60 sn önbellek (kişiden bağımsız sorgular) ----
// Anahtar: işlev argümanları (where/take/skip veya ürün kimliği). Hiçbir kişisel veri (oturum, favori, yorum yetkisi) bu işlevlere girmez.
// Etiket "storefront": revalidateStorefront() yönetici işlemlerinde bunları da geçersiz kılar. Kart alanlarında zaman damgası yoktur (JSON güvenli).
export const STOREFRONT_CACHE_SECONDS = 60;
export const getProductsCached = unstable_cache(getProducts, ["sf-products"], { revalidate: STOREFRONT_CACHE_SECONDS, tags: ["storefront"] });
export const countProductsCached = unstable_cache(async (where: Prisma.ProductWhereInput) => countProducts(where), ["sf-count"], { revalidate: STOREFRONT_CACHE_SECONDS, tags: ["storefront"] });

/** Ürün detayı: ürün + varyasyonlar + ONAYLI yorumlar (yorumcu adı). Kişiye bağlı değildir; tarihler ISO metin olarak döner (önbellek JSON'dur). */
export const getProductDetail = unstable_cache(
  async (id: string) => {
    const p = await prisma.product.findUnique({
      where: { id },
      include: { variations: true, reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } } },
    });
    if (!p) return null;
    return {
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      reviews: p.reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  },
  ["sf-product-detail"],
  { revalidate: STOREFRONT_CACHE_SECONDS, tags: ["storefront"] }
);

export type ProductWithVariations = Awaited<ReturnType<typeof getProducts>>[number];

// Otomatik "İndirimliler": üstü çizili eski fiyatı olan (listPrice yalnızca basePrice'tan yüksekse tutulur) veya adet indirimi tanımlı ürünler
export const DISCOUNTED: Prisma.ProductWhereInput = { OR: [{ listPrice: { not: null } }, { bulkMinQty: { not: null } }] };
// Avize/aydınlatma ürünleri (aksesuar hariç), en az bir varyasyonu stokta
export const FEATURED: Prisma.ProductWhereInput = {
  category: { not: "Aksesuar" },
  variations: { some: { stock: { gt: 0 } } },
};


/** Öne Çıkanlar: yönetici işaretlileri; hiç işaretli yoksa eski otomatik seçime düşer. */
export async function getFeatured(take: number) {
  const flagged = await getProducts({ isFeatured: true }, take);
  return flagged.length > 0 ? flagged : getProducts(FEATURED, take);
}

/** Son 90 günde en çok sipariş edilen ürün kimlikleri (çoktan aza). Tüm geçmiş yerine 90 gün; sonuç 5 dk önbellekte (yalnızca kimlik listesi). */
const getRankedSellerIds = unstable_cache(
  async (): Promise<string[]> => {
    const sold = await prisma.orderItem.groupBy({
      by: ["variationId"],
      where: { order: { createdAt: { gte: bestSellerSince() }, status: { notIn: ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"] } } },
      _sum: { quantity: true },
    });
    const variations = sold.length ? await prisma.productVariation.findMany({ where: { id: { in: sold.map((r) => r.variationId) } }, select: { id: true, productId: true } }) : [];
    const productOf = new Map(variations.map((v) => [v.id, v.productId]));
    return rankProducts(sold.flatMap((r) => (productOf.has(r.variationId) ? [{ productId: productOf.get(r.variationId)!, quantity: r._sum.quantity ?? 0 }] : [])));
  },
  ["best-seller-ids-90d"],
  { revalidate: BEST_SELLER_CACHE_SECONDS, tags: ["storefront"] }
);

/** Çok Satanlar: yönetici işaretlileri önce; eksik kalırsa en çok sipariş edilen aktif ürünlerle, o da yetmezse güncel ürünlerle tamamlanır. */
export async function getBestSellers(take: number) {
  const picked = await getProducts({ isBestSeller: true }, take);
  if (picked.length >= take) return picked;
  const seen = new Set(picked.map((p) => p.id));

  const rankedIds = (await getRankedSellerIds()).filter((id) => !seen.has(id));

  const ranked = rankedIds.length ? await getProducts({ id: { in: rankedIds }, ...FEATURED }, undefined) : [];
  ranked.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
  const out = [...picked, ...ranked].slice(0, take);
  if (out.length >= take) return out;

  const have = new Set(out.map((p) => p.id));
  const filler = await getProducts({ ...FEATURED, id: { notIn: [...have] } }, take - out.length);
  return [...out, ...filler];
}
