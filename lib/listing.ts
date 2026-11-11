import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { categoryKey } from "@/lib/categories";
import { categoryDisplayTitle } from "@/lib/category-settings";
import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { cacheNonEmpty, getCardsByIds, getCardsCached, getRankedSellerIds, type ProductWithVariations } from "@/lib/products";
import { LISTING_ROWS_CACHE_SECONDS, STOREFRONT_CACHE_VERSION as ROWS_CACHE_VERSION, productsCacheKey, storefrontTags } from "@/lib/storefront-cache-key";
import { rowFilter } from "@/lib/listing-where";
import { getVisibleWhere, getVisibleWhereStrict } from "@/lib/visibility";
import { MAX_SEARCH_RESULTS } from "@/lib/product-search";
import { matchesSearch, normalizeSearch, rankSearchRows, searchText } from "@/lib/search-rank";
import { applyListing, isDefaultState, parseSize, variationAttrs, parseListingParams, stateToParams, type CatMeta, type ListingResult, type ListingRow } from "@/lib/listing-core";

/**
 * Ortak ürün listesi veri katmanı (/arama ve /kategori/[slug]). Taban kümenin hafif satırları (kimlik, kategori, kartta gösterilen fiyat, tarih, renkler) bir kez okunur;
 * sıralama, filtre ve facet sayıları bellekte (lib/listing-core.ts) hesaplanır. Sayfadaki ürünler yalnızca o sayfanın kimlikleriyle çekilir.
 * Fiyat = Product.basePrice: ProductCard'ın gösterdiği değerle aynıdır (lib/pricing.ts / cart-pricing.ts'e dokunulmaz).
 * Renk/ebat: variationType "Renk" (yönetim) ve "Seçenek" (Trendyol, "Renk / EnxBoy" kalıbı); ayıklama lib/listing-core.ts variationAttrs içindedir. Aynı varyasyon sorgusu (ek sorgu yok).
 */
export const LISTING_ROW_CAP = 1000;

export type ListingBase =
  | { where: Prisma.ProductWhereInput; cached: boolean; cap?: number }
  /** Normalize metin araması (/arama) */
  | { search: string }
  /** Hazır ürün listesi (Çok Satanlar): sıra bu listenin sırasıdır */
  | { products: ProductWithVariations[] };

const ROW_SELECT = {
  id: true,
  title: true,
  category: true,
  basePrice: true,
  createdAt: true,
  updatedAt: true,
  isFeatured: true,
  ebat: true,
  modelCode: true,
  active: true,
  listPrice: true,
  bulkMinQty: true,
  variations: { select: { variationType: true, variationValue: true, stock: true, barcode: true, stockCode: true } }, // stok: "stokta" sırası/filtresi; renk-ebat yalnızca Renk/Seçenek türlerinden
} satisfies Prisma.ProductSelect;

/** Açıklamanın yalnızca başı aranır; kırpma VERİTABANINDA yapılır (left): tam açıklama metni Neon'dan hiç çıkmaz. */
export const SEARCH_DESCRIPTION_CHARS = 300;

/** Arama metni için kırpılmış açıklamalar (ürün kimliği → ilk SEARCH_DESCRIPTION_CHARS karakter). */
async function loadDescriptionHeads(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; d: string | null }[]>`SELECT "id", left("description", ${SEARCH_DESCRIPTION_CHARS}) AS d FROM "Product" WHERE "id" = ANY(${ids}) AND "description" IS NOT NULL`;
  return new Map(rows.flatMap((r) => (r.d ? [[r.id, r.d] as const] : [])));
}

async function loadRows(where: Prisma.ProductWhereInput, cap: number, visible: () => Promise<Prisma.ProductWhereInput> = getVisibleWhere): Promise<ListingRow[]> {
  const rows = await prisma.product.findMany({
    where: { AND: [await visible(), where] }, // vitrin görünürlüğü TEK kaynak: lib/visibility.ts
    select: ROW_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }], // getProducts ile aynı varsayılan sıra
    take: cap,
  });
  const heads = await loadDescriptionHeads(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    search: searchText([r.title, r.category, r.ebat, heads.get(r.id), ...r.variations.flatMap((v) => [v.variationValue, v.barcode, v.stockCode])]),
    mc: r.modelCode ? normalizeSearch(r.modelCode) : null,
    cat: categoryKey(r.category),
    rc: r.category,
    active: r.active,
    disc: r.listPrice !== null || r.bulkMinQty !== null,
    price: r.basePrice,
    created: r.createdAt.getTime(),
    updated: r.updatedAt.getTime(),
    featured: r.isFeatured,
    own: r.ebat ? parseSize(r.ebat) : null,
    inStock: r.variations.some((v) => v.stock > 0),
    vars: r.variations.flatMap((v) => {
      if (v.variationType !== "Renk" && v.variationType !== "Seçenek") return [];
      const a = variationAttrs(v.variationType, v.variationValue);
      return a.c || a.s ? [a] : [];
    }),
  }));
}

// TEK paylaşılan önbellek girdisi: vitrinde görünen tüm kataloğun hafif satırları. Arama, kategori ve koleksiyon sayfaları bu girdiyi bellekte süzer
// (lib/listing-where.ts); kategori başına ayrı veritabanı okuması ve ayrı girdi oluşmaz. Süre LISTING_ROWS_CACHE_SECONDS; "storefront" etiketi
// (revalidateStorefront) stok/fiyat/ürün değişince hemen sona erdirir.
// Anahtardaki sürüm: satır şekli değişince (v9: rc/active/disc eklendi, açıklama 300 karaktere indi) eski şekilli girdiler okunmasın. Şekil değişince artırın.
// Boş sonuç önbelleğe yazılmaz. Görünürlük ayarı okunamazsa yedek sonuç önbelleğe girmez, bu istek için önbelleksiz okunur.
const loadRowsCached = (where: Prisma.ProductWhereInput, cap: number) =>
  cacheNonEmpty(["sf-listing-rows", ROWS_CACHE_VERSION, productsCacheKey(where, cap)], storefrontTags(where), () => loadRows(where, cap, getVisibleWhereStrict), LISTING_ROWS_CACHE_SECONDS).catch(() => loadRows(where, cap));
const catalogRows = () => loadRowsCached({}, LISTING_ROW_CAP);

/** Koşullu taban (kategori/koleksiyon): tanınan koşul katalogdan bellekte süzülür (sıra aynı: updatedAt azalan, id); tanınmayan koşul eski yoldan veritabanından okunur. */
async function rowsForWhere(where: Prisma.ProductWhereInput, cap: number, cached: boolean): Promise<ListingRow[]> {
  const test = cached ? rowFilter(where) : null;
  if (test) return (await catalogRows()).filter(test).slice(0, cap);
  return cached ? loadRowsCached(where, cap) : loadRows(where, cap);
}

/** Normalize arama (/arama ve /api/search): tek önbellekli katalogdan bellekte süzülür. Alaka sırası için çağıran rankSearchRows uygular. */
const searchRows = async (q: string) => (await catalogRows()).filter((r) => matchesSearch(r, q)).slice(0, MAX_SEARCH_RESULTS);

/** Üst arama kutusu: tam model kodu önde, sonra alaka sırası; yalnızca kimlikler. */
export async function searchProductIds(q: string, take: number): Promise<string[]> {
  const n = normalizeSearch(q);
  const ranked = rankSearchRows(await searchRows(q), q);
  return [...ranked.filter((r) => r.mc === n), ...ranked.filter((r) => r.mc !== n)].slice(0, take).map((r) => r.id);
}

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

/** `search` tabanı: yalnızca /arama; varsayılan "onerilen" sıralamada başlık alaka kuralı (lib/search-rank.ts) uygulanır, diğer sıralamalar ve kategori sayfaları değişmez. */
export async function getListing(base: ListingBase, query: Record<string, string | string[] | undefined>): Promise<Listing> {
  const raw = parseListingParams(query);
  const cats = await categoryMetas();

  let rows: ListingRow[];
  if ("search" in base) {
    rows = await searchRows(base.search);
  } else if ("products" in base) {
    const ids = base.products.map((p) => p.id);
    const byId = new Map((await catalogRows()).map((r) => [r.id, r])); // Çok Satanlar ürünleri aktif = katalogda; ayrı okuma yok
    rows = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  } else {
    const cap = base.cap ?? LISTING_ROW_CAP;
    rows = await rowsForWhere(base.where, cap, base.cached);
  }

  if ("search" in base && raw.siralama === "onerilen") rows = rankSearchRows(rows, base.search);

  const rankIds = raw.siralama === "cok-satan" ? await getRankedSellerIds().catch(() => []) : undefined;
  const result = applyListing(rows, raw, { cats, rankIds });
  const cachePage = "where" in base && base.cached && isDefaultState(result.state);

  const updatedOf = new Map(rows.map((r) => [r.id, r.updated]));

  const fetchPage = async (page: number, size: number) => {
    const ids = result.ids.slice((page - 1) * size, page * size);
    if (ids.length === 0) return [];
    let found: ProductWithVariations[];
    if ("products" in base) found = base.products.filter((p) => ids.includes(p.id));
    else if (cachePage) found = await getCardsCached(ids, `${ROWS_CACHE_VERSION}:${ids.map((id) => updatedOf.get(id) ?? 0).join(",")}`); // satır sürümüne bağlı
    else found = await getCardsByIds(ids);
    const byId = new Map(found.map((p) => [p.id, p]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  };

  return { ...result, params: stateToParams(result.state), fetchPage };
}
