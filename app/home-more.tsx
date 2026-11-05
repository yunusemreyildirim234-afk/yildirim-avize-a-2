"use server";

import type { ReactNode } from "react";
import ProductCard from "@/components/ProductCard";
import { SECTION_KEYS, composeSection, type SectionKey } from "@/lib/homepage-compose";
import { getHomepageConfig, getSectionPools } from "@/lib/homepage";

const MORE_PAGE_SIZE = 24;

type MoreResult = { ok: true; items: { id: string; node: ReactNode }[]; total: number } | { ok: false };

/**
 * Ana sayfa bölümünde "Daha fazla göster": ilk görünür ürünlerden sonraki ürünleri TIKLANINCA getirir.
 * Salt okunur; seçim/sıralama/sabitleme mantığı sayfadakiyle aynı (composeSection) ve aynı havuzlardan okunur.
 * Kartlar sunucuda üretilir (ProductCard sunucu bileşeni), böylece görünüm ve etkileşim sayfadakiyle birebir aynıdır.
 */
export async function loadMoreProducts(section: string, offset: number): Promise<MoreResult> {
  if (!(SECTION_KEYS as readonly string[]).includes(section) || !Number.isInteger(offset) || offset < 0 || offset > 1000) return { ok: false };
  try {
    const key = section as SectionKey;
    const [config, pools] = await Promise.all([getHomepageConfig(), getSectionPools()]);
    const pool = key === "featured" ? pools.featured : key === "discounted" ? pools.discounted : pools.bestsellers;
    const { more } = composeSection(pool, config[key], key === "featured" ? pools.featuredManual : false);
    const items = more.slice(offset, offset + MORE_PAGE_SIZE).map((p) => ({ id: p.id, node: <ProductCard key={p.id} product={p} dark={key === "bestsellers"} /> }));
    return { ok: true, items, total: more.length };
  } catch (e) {
    console.error("[home-more] ürünler getirilemedi:", (e as Error).message);
    return { ok: false };
  }
}
