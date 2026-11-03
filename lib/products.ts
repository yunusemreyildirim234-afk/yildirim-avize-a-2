import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

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

/** Çok Satanlar: yönetici işaretlileri önce; eksik kalırsa en çok sipariş edilen aktif ürünlerle, o da yetmezse güncel ürünlerle tamamlanır. */
export async function getBestSellers(take: number) {
  const picked = await getProducts({ isBestSeller: true }, take);
  if (picked.length >= take) return picked;
  const seen = new Set(picked.map((p) => p.id));

  const sold = await prisma.orderItem.groupBy({
    by: ["variationId"],
    where: { order: { status: { notIn: ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"] } } },
    _sum: { quantity: true },
  });
  const variations = sold.length
    ? await prisma.productVariation.findMany({ where: { id: { in: sold.map((r) => r.variationId) } }, select: { id: true, productId: true } })
    : [];
  const productOf = new Map(variations.map((v) => [v.id, v.productId]));
  const perProduct = new Map<string, number>();
  for (const r of sold) {
    const pid = productOf.get(r.variationId);
    if (pid) perProduct.set(pid, (perProduct.get(pid) ?? 0) + (r._sum.quantity ?? 0));
  }
  const rankedIds = [...perProduct.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => !seen.has(id));

  const ranked = rankedIds.length ? await getProducts({ id: { in: rankedIds }, ...FEATURED }, undefined) : [];
  ranked.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
  const out = [...picked, ...ranked].slice(0, take);
  if (out.length >= take) return out;

  const have = new Set(out.map((p) => p.id));
  const filler = await getProducts({ ...FEATURED, id: { notIn: [...have] } }, take - out.length);
  return [...out, ...filler];
}
