import { cache } from "react";
import { prisma } from "@/lib/db";
import { DISCOUNTED, FEATURED, getBestSellers, getProducts } from "@/lib/products";
import { resolveConfig, type ResolvedConfig } from "@/lib/homepage-compose";

/** Ana sayfa yapılandırması: istek başına bir kez okunur; hata/boş → varsayılan (ana sayfa asla bozulmaz). */
export const getHomepageConfig = cache(async (): Promise<ResolvedConfig> => {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    return resolveConfig(row?.homepageConfig);
  } catch (e) {
    console.error("[homepage] yapılandırma okunamadı:", (e as Error).message);
    return resolveConfig(null);
  }
});

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
