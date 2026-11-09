import type { Prisma } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { STOREFRONT_CACHE_VERSION } from "@/lib/storefront-cache-key";
import { DEFAULT_STOCKLESS_RULE, resolveStocklessRule, soldOutInactiveWhere, stocklessEnabled, stocklessShown, visibleWhere, type StocklessRule } from "@/lib/stockless";

/**
 * Vitrin görünürlüğü için sunucu tarafı tek kaynak (kural: lib/stockless.ts). Ayar kapalıyken sorgu yapılmaz (eski davranış, sıfır maliyet);
 * açıkken tek bir groupBy (pasif + stoksuz ürünlerin kategori sayıları) çalışır. 60 sn önbellek, "storefront" etiketi (yönetici kaydı geçersiz kılar).
 */
export const getStocklessState = unstable_cache(
  async (): Promise<{ rule: StocklessRule; spellings: string[]; rows: { category: string; count: number }[] }> => {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    const rule = resolveStocklessRule(row?.homepageConfig);
    if (!stocklessEnabled(rule)) return { rule, spellings: [], rows: [] };
    const groups = await prisma.product.groupBy({ by: ["category"], where: soldOutInactiveWhere(rule.hiddenIds), _count: { _all: true } });
    return { rule, ...stocklessShown(rule, groups.map((g) => ({ category: g.category, count: g._count._all }))) };
  },
  ["sf-stockless-state", STOREFRONT_CACHE_VERSION],
  { revalidate: 60, tags: ["storefront"] }
);

/** Hata olursa kural kapalı sayılır (vitrin eski davranışla çalışır). */
export async function getStocklessRule(): Promise<StocklessRule> {
  try {
    return (await getStocklessState()).rule;
  } catch {
    return DEFAULT_STOCKLESS_RULE;
  }
}

/** Vitrinde görünür ürün koşulu (Prisma); her vitrin sorgusu bunu `AND` ile birleştirir. */
export async function getVisibleWhere(): Promise<Prisma.ProductWhereInput> {
  try {
    const st = await getStocklessState();
    return visibleWhere(st.spellings, st.rule.hiddenIds);
  } catch {
    return { active: true };
  }
}

/** Önbelleğe girecek sorgular için: ayar okunamazsa hata fırlatır (yedek "yalnızca aktif" sonucu önbelleğe yazılmasın). */
export async function getVisibleWhereStrict(): Promise<Prisma.ProductWhereInput> {
  const st = await getStocklessState();
  return visibleWhere(st.spellings, st.rule.hiddenIds);
}

/** Kategori sayılarına eklenecek (görünür) stoksuz ürün satırları. */
export async function getStocklessCategoryRows(): Promise<{ category: string; count: number }[]> {
  try {
    return (await getStocklessState()).rows;
  } catch {
    return [];
  }
}
