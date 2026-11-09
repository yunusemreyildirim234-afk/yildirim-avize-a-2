import type { Prisma } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { BEST_SELLER_CACHE_SECONDS, bestSellerSince, rankProducts } from "@/lib/best-sellers-rules";
import { productsCacheKey, storefrontTags } from "@/lib/storefront-cache-key";
import { SHOWCASE_ORDER_BY } from "@/lib/showcase-order";
import { resolveHiddenBestSellers } from "@/lib/homepage-compose";
import { getVisibleWhere } from "@/lib/visibility";

/**
 * Kart/liste için gereken alanlar (ProductCard, priceLadder, bulkTiersOf, ana sayfa havuzları).
 * description, brand, trendyol* ve zaman damgaları çekilmez.
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
  variations: { select: { id: true, variationValue: true, extraPrice: true, stock: true, images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.ProductSelect;

/** Kart galerisi için genel fotoğraflar (images) da gerekir; arama gibi yalnızca kapak kullanan uçlar CARD_SELECT'te kalır. */
const CARD_LIST_SELECT = { ...CARD_SELECT, images: true } satisfies Prisma.ProductSelect;

/** Vitrin görünürlüğü (lib/visibility.ts): aktif ürünler + ayar açıksa "Tükendi" görünen pasif ürünler. Ana sayfa vitrinleri bunu KULLANMAZ (getActiveProducts). */
export async function getProducts(where: Prisma.ProductWhereInput = {}, take?: number, skip?: number) {
  return prisma.product.findMany({
    where: { AND: [await getVisibleWhere(), where] },
    select: CARD_LIST_SELECT,
    // Sayfalama (skip) kullanılırken eşit updatedAt değerlerinde sayfalar arası kayma olmasın diye id ile kararlı sıra
    orderBy: skip === undefined ? { updatedAt: "desc" } : [{ updatedAt: "desc" }, { id: "asc" }],
    take,
    skip,
  });
}

/** Yalnızca AKTİF ürünler (ana sayfa havuzları, benzer ürünler): stoksuz görünen pasif ürünler buraya girmez. */
export async function getActiveProducts(where: Prisma.ProductWhereInput = {}, take?: number) {
  return prisma.product.findMany({ where: { active: true, ...where }, select: CARD_LIST_SELECT, orderBy: { updatedAt: "desc" }, take });
}

/** Ana sayfa vitrini (Öne Çıkanlar / Çok Satanlar) için: getProducts ile aynı seçim, ama updatedAt'tan bağımsız sabit sıra (lib/showcase-order.ts). */
export async function getShowcaseProducts(where: Prisma.ProductWhereInput = {}, take?: number) {
  return prisma.product.findMany({ where: { active: true, ...where }, select: CARD_LIST_SELECT, orderBy: SHOWCASE_ORDER_BY, take });
}

/** getProducts ile aynı koşulla (vitrinde görünür) ürün sayısı. */
export async function countProducts(where: Prisma.ProductWhereInput = {}) {
  return prisma.product.count({ where: { AND: [await getVisibleWhere(), where] } });
}

// ---- Veri düzeyinde 60 sn önbellek (kişiden bağımsız sorgular) ----
// Anahtar: işlev argümanları (where/take/skip veya ürün kimliği). Hiçbir kişisel veri (oturum, favori, yorum yetkisi) bu işlevlere girmez.
// Etiket "storefront": revalidateStorefront() yönetici işlemlerinde bunları da geçersiz kılar. Kart alanlarında zaman damgası yoktur (JSON güvenli).
export const STOREFRONT_CACHE_SECONDS = 60;
// Anahtar açıkça parametrelerden (where/take/skip) üretilir; etiketler: "storefront" + varsa kategoriye özel.
export const getProductsCached = (where: Prisma.ProductWhereInput = {}, take?: number, skip?: number) =>
  unstable_cache(() => getProducts(where, take, skip), ["sf-products", productsCacheKey(where, take, skip)], { revalidate: STOREFRONT_CACHE_SECONDS, tags: storefrontTags(where) })();
export const countProductsCached = (where: Prisma.ProductWhereInput = {}) =>
  unstable_cache(() => countProducts(where), ["sf-count", productsCacheKey(where)], { revalidate: STOREFRONT_CACHE_SECONDS, tags: storefrontTags(where) })();

class EmptyCacheResult extends Error {}

/** Boş sonucu önbelleğe YAZMAZ: anlık boş okuma (toplu işlem ortası vb.) sonraki ziyaretçilere sunulmaz; gerçekten boşsa her istekte taze okunur. */
export async function cacheNonEmpty<T>(key: string[], tags: string[], load: () => Promise<T[]>): Promise<T[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await load();
      if (rows.length === 0) throw new EmptyCacheResult();
      return rows;
    },
    key,
    { revalidate: STOREFRONT_CACHE_SECONDS, tags }
  );
  try {
    return await cached();
  } catch (e) {
    if (e instanceof EmptyCacheResult) return [];
    throw e;
  }
}

/** Liste kartları: görünürlüğü satır listesi belirlemiştir, burada yeniden süzülmez (liste "4 ürün" derken kartların boş gelmemesi için). */
export const getCardsByIds = (ids: string[]) => prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_LIST_SELECT });
/** Kart girdisi satır sürümüne bağlıdır: satırlar değişince kartlar da yeni anahtardan okunur. */
export const getCardsCached = (ids: string[], version: string) => cacheNonEmpty(["sf-cards", version, JSON.stringify(ids)], ["storefront"], () => getCardsByIds(ids));

/** Ürün detayı: ürün + varyasyonlar + ONAYLI yorumlar (yorumcu adı). Kişiye bağlı değildir; tarihler ISO metin olarak döner (önbellek JSON'dur). */
export const getProductDetail = unstable_cache(
  async (id: string) => {
    const p = await prisma.product.findUnique({
      where: { id },
      omit: { syncSnapshot: true, lastSyncedAt: true }, include: { variations: { omit: { syncSnapshot: true, syncStock: true }, orderBy: [{ position: "asc" }, { id: "asc" }] }, reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } } },
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
  const flagged = await getShowcaseProducts({ isFeatured: true }, take);
  return flagged.length > 0 ? flagged : getShowcaseProducts(FEATURED, take);
}

/** Son 90 günde en çok sipariş edilen ürün kimlikleri (çoktan aza). Tüm geçmiş yerine 90 gün; sonuç 5 dk önbellekte (yalnızca kimlik listesi). */
export const getRankedSellerIds = unstable_cache(
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

/** Çok Satanlar'dan elle gizlenen ürün kimlikleri (homepageConfig.hiddenBestSellers). Okunamazsa boş: liste bozulmaz. */
export async function getHiddenBestSellerIds(): Promise<string[]> {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    return resolveHiddenBestSellers(row?.homepageConfig);
  } catch {
    return [];
  }
}

/**
 * Çok Satanlar: yönetici işaretlileri önce; eksik kalırsa en çok sipariş edilen aktif ürünlerle, o da yetmezse güncel ürünlerle tamamlanır.
 * Elle gizlenenler (hiddenBestSellers) her aşamada dışarıda kalır; elle işaretli (isBestSeller) ile çakışırsa GİZLEME KAZANIR.
 * Ürün yalnızca bu listeden çıkar; ürün sayfası, kategori sayfaları ve diğer bölümler etkilenmez.
 */
export async function getBestSellers(take: number) {
  const hidden = await getHiddenBestSellerIds();
  const picked = await getShowcaseProducts({ isBestSeller: true, ...(hidden.length ? { id: { notIn: hidden } } : {}) }, take);
  if (picked.length >= take) return picked;
  const seen = new Set(picked.map((p) => p.id));
  const hiddenSet = new Set(hidden);

  const rankedIds = (await getRankedSellerIds()).filter((id) => !seen.has(id) && !hiddenSet.has(id));

  const ranked = rankedIds.length ? await getActiveProducts({ id: { in: rankedIds }, ...FEATURED }) : [];
  ranked.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
  const out = [...picked, ...ranked].slice(0, take);
  if (out.length >= take) return out;

  const have = new Set(out.map((p) => p.id));
  const filler = await getShowcaseProducts({ ...FEATURED, id: { notIn: [...have, ...hidden] } }, take - out.length);
  return [...out, ...filler];
}
