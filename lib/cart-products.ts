import { catalogRows } from "@/lib/listing";
import type { ProductWithVariations } from "@/lib/products";
import { cardWindowFetcher } from "@/lib/similar-products";
import { SIMILAR_PAGE_SIZE, collectPage, type SimilarPage } from "@/lib/similar-strip";
import { cartStripList } from "@/lib/cart-strip";

/**
 * Sepet şeridi: sepet kategorilerinden karışık, sepette olmayan, aktif ve stoklu ürünler; 8'lik sayfalar.
 * Kart önbelleği anahtarı yalnız listedeki pencere kimliklerine bağlıdır (kategori kümesi); sepetteki ürünler bellekte atılır, anahtara girmez.
 */
export async function loadCartProducts(productIds: string[], cursor: number): Promise<SimilarPage<ProductWithVariations>> {
  const rows = await catalogRows();
  const list = cartStripList(rows, productIds);
  return collectPage(list, new Set(productIds), cursor, SIMILAR_PAGE_SIZE, cardWindowFetcher(rows));
}
