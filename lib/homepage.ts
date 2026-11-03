import { cache } from "react";
import { prisma } from "@/lib/db";
import { DISCOUNTED, FEATURED, getBestSellers, getProducts } from "@/lib/products";
import { resolveConfig, type ResolvedConfig } from "@/lib/homepage-compose";

/** Ham ana sayfa JSON'u: istek başına bir kez okunur (bölümler ve avantaj kartları aynı okumayı paylaşır); hata → null. */
export const getHomepageRaw = cache(async (): Promise<unknown> => {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    return row?.homepageConfig ?? null;
  } catch (e) {
    console.error("[homepage] yapılandırma okunamadı:", (e as Error).message);
    return null;
  }
});

/** Ana sayfa yapılandırması; hata/boş → varsayılan (ana sayfa asla bozulmaz). */
export const getHomepageConfig = cache(async (): Promise<ResolvedConfig> => resolveConfig(await getHomepageRaw()));

const POOL = 100;

/** Bölümlerin güncel ürün havuzları (doğal sıralamayla; yalnızca aktif ürünler). Elle işaretli Öne Çıkan varsa yalnızca onlar. */
export const getSectionPools = cache(async () => {
  const flagged = await getProducts({ isFeatured: true }, POOL);
  const [featuredAuto, discounted, bestsellers] = await Promise.all([
    flagged.length > 0 ? Promise.resolve(flagged) : getProducts(FEATURED, POOL),
    getProducts(DISCOUNTED, POOL),
    getBestSellers(POOL),
  ]);
  return { featured: featuredAuto, featuredManual: flagged.length > 0, discounted, bestsellers };
});
