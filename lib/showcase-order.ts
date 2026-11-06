/**
 * Ana sayfa vitrin bölümlerinin (Öne Çıkanlar, Çok Satanlar doldurma kademesi) SABİT sıralaması: eklenme tarihi azalan, eşitlikte id.
 * updatedAt kullanılmaz: stok senkronu, Trendyol eşitlemesi veya küçük bir düzenleme vitrini karıştırmasın.
 * Kategori sayfaları ve diğer listeler bundan etkilenmez (onlar lib/products.ts getProducts'taki updatedAt sırasını kullanır).
 */
export const SHOWCASE_ORDER_BY = [{ createdAt: "desc" as const }, { id: "asc" as const }];
