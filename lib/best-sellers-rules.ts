/** Çok Satanlar sıralaması: yalnızca son N gün ve 5 dk önbellek (saf sabitler/yardımcılar; test edilebilir). */
export const BEST_SELLER_DAYS = 90;
export const BEST_SELLER_CACHE_SECONDS = 300;

export const bestSellerSince = (now: number = Date.now()) => new Date(now - BEST_SELLER_DAYS * 24 * 3600_000);

/** Satış adetlerinden ürün sırası (çoktan aza; eşitlikte ilk görülen önde). */
export function rankProducts(rows: { productId: string; quantity: number }[]): string[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.productId, (m.get(r.productId) ?? 0) + r.quantity);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
