import type { Prisma } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { categoryKey } from "@/lib/categories";
import { categoryDisplayTitle } from "@/lib/category-settings";
import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { STOREFRONT_CACHE_SECONDS, getProducts, getProductsCached, getRankedSellerIds, type ProductWithVariations } from "@/lib/products";
import { productsCacheKey, storefrontTags } from "@/lib/storefront-cache-key";
import { applyListing, isDefaultState, variationAttrs, parseListingParams, stateToParams, type CatMeta, type ListingResult, type ListingRow } from "@/lib/listing-core";

/**
 * Ortak ürün listesi veri katmanı (/arama ve /kategori/[slug]). Taban kümenin hafif satırları (kimlik, kategori, kartta gösterilen fiyat, tarih, renkler) bir kez okunur;
 * sıralama, filtre ve facet sayıları bellekte (lib/listing-core.ts) hesaplanır. Sayfadaki ürünler yalnızca o sayfanın kimlikleriyle çekilir.
 * Fiyat = Product.basePrice: ProductCard'ın gösterdiği değerle aynıdır (lib/pricing.ts / cart-pricing.ts'e dokunulmaz).
 * Renk/ebat: variationType "Renk" (yönetim) ve "Seçenek" (Trendyol, "Renk / EnxBoy" kalıbı); ayıklama lib/listing-core.ts variationAttrs içindedir. Aynı varyasyon sorgusu (ek sorgu yok).
 */
export const LISTING_ROW_CAP = 1000;

export type ListingBase =
  | { where: Prisma.ProductWhereInput; cached: boolean; cap?: number }
  /** Hazır ürün listesi (Çok Satanlar): sıra bu listenin sırasıdır */
  | { products: ProductWithVariations[] };

const ROW_SELECT = {
  id: true,
  category: true,
  basePrice: true,
  createdAt: true,
  updatedAt: true,
  isFeatured: true,
  variations: { where: { variationType: { in: ["Renk", "Seçenek"] } }, select: { variationType: true, variationValue: true } },
} satisfies Prisma.ProductSelect;

async function loadRows(where: Prisma.ProductWhereInput, cap: number): Promise<ListingRow[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, ...where },
    select: ROW_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }], // getProducts ile aynı varsayılan sıra
    take: cap,
  });
  return rows.map((r) => ({
    id: r.id,
    cat: categoryKey(r.category),
    price: r.basePrice,
    created: r.createdAt.getTime(),
    updated: r.updatedAt.getTime(),
    featured: r.isFeatured,
    vars: r.variations.flatMap((v) => {
      const a = variationAttrs(v.variationType, v.variationValue);
      return a.c || a.s ? [a] : [];
    }),
  }));
}

// Önbellek yalnızca denetimli tabanlarda (kategori/koleksiyon koşulu); arama sorgusu başına anahtar üretilmez.
// Anahtardaki sürüm: satır şekli değişince (v2: colors → vars) eski şekilli önbellek girdileri (dağıtım sonrası eskiyi sun) okunmasın. Şekil değişince artırın.
const ROWS_CACHE_VERSION = "v2";
const loadRowsCached = (where: Prisma.ProductWhereInput, cap: number) =>
  unstable_cache(() => loadRows(where, cap), ["sf-listing-rows", ROWS_CACHE_VERSION, productsCacheKey(where, cap)], { revalidate: STOREFRONT_CACHE_SECONDS, tags: storefrontTags(where) })();

async function categoryMetas(): Promise<CatMeta[]> {
  const [list, settings] = await Promise.all([getCategoryList().catch(() => []), getCategorySettings()]);
  return list.map((e) => ({ key: e.key, slug: e.slug, title: e.fixed ? categoryDisplayTitle(settings, e.key, e.title) : e.title }));
}

export interface Listing extends ListingResult {
  /** Normalleştirilmiş adres parametreleri (sayfa/adet hariç) */
  params: Record<string, string>;
  /** Verilen (1 tabanlı) sayfanın ürünleri, sıralı */
  fetchPage: (page: number, size: number) => Promise<ProductWithVariations[]>;
}

export async function getListing(base: ListingBase, query: Record<string, string | string[] | undefined>): Promise<Listing> {
  const raw = parseListingParams(query);
  const cats = await categoryMetas();

  let rows: ListingRow[];
  if ("products" in base) {
    const ids = base.products.map((p) => p.id);
    const byId = new Map((await loadRows({ id: { in: ids } }, ids.length || 1)).map((r) => [r.id, r]));
    rows = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  } else {
    const cap = base.cap ?? LISTING_ROW_CAP;
    rows = base.cached ? await loadRowsCached(base.where, cap) : await loadRows(base.where, cap);
  }

  const rankIds = raw.siralama === "cok-satan" ? await getRankedSellerIds().catch(() => []) : undefined;
  const result = applyListing(rows, raw, { cats, rankIds });
  const cachePage = "where" in base && base.cached && isDefaultState(result.state);

  const fetchPage = async (page: number, size: number) => {
    const ids = result.ids.slice((page - 1) * size, page * size);
    if (ids.length === 0) return [];
    let found: ProductWithVariations[];
    if ("products" in base) found = base.products.filter((p) => ids.includes(p.id));
    else found = cachePage ? await getProductsCached({ id: { in: ids } }) : await getProducts({ id: { in: ids } });
    const byId = new Map(found.map((p) => [p.id, p]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  };

  return { ...result, params: stateToParams(result.state), fetchPage };
}
