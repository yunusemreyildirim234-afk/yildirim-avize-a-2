import { catalogRows } from "@/lib/listing";
import { getCardsCached, type ProductWithVariations } from "@/lib/products";
import { STOREFRONT_CACHE_VERSION } from "@/lib/storefront-cache-key";
import { SIMILAR_PAGE_SIZE, collectPage, similarList, type SimilarPage, type SimilarRow } from "@/lib/similar-strip";

/** Pencere okuyucu: kimlik kümesi + satır sürümüne bağlı önbellekli kart okuması (ürün sayfası ve sepet şeridi ortak). */
export const cardWindowFetcher = (rows: (SimilarRow & { id: string })[]) => {
  const updated = new Map(rows.map((r) => [r.id, r.updated]));
  return (ids: string[]) => getCardsCached(ids, `${STOREFRONT_CACHE_VERSION}:${ids.map((id) => updated.get(id) ?? 0).join(",")}`);
};

/**
 * Ürün sayfası şeridi: aynı kategorideki aktif ve stoklu ürünler (kendi ürün hariç), 8'lik sayfalar.
 * Liste paylaşılan katalog önbelleğinden bellekte süzülür; kartlar listeye hizalı pencerelerle getCardsCached'ten okunur (pencere başına en çok 1 sorgu).
 */
export async function loadSimilarProducts(category: string, excludeId: string, cursor: number): Promise<SimilarPage<ProductWithVariations>> {
  const rows = await catalogRows();
  return collectPage(similarList(rows, category), excludeId, cursor, SIMILAR_PAGE_SIZE, cardWindowFetcher(rows));
}
