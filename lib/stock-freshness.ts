// Vitrinde stok tazeliği (M9) için saf yardımcılar: veritabanı ve Next önbelleği parametre olarak gelir (test edilebilir).

export interface LiveStockRow {
  id: string;
  stock: number;
}

/**
 * Önbellekli ürünün varyasyon stoklarını canlı okunan değerlerle ezer; diğer alanlara dokunmaz, girdiyi değiştirmez.
 * Canlı okuma başarısızsa (rows boş/null) ya da bir varyasyon canlı listede yoksa önbellekli değer kalır (sayfa bozulmaz).
 */
export function applyLiveStock<V extends LiveStockRow, P extends { variations: V[] }>(product: P, rows: readonly LiveStockRow[] | null | undefined): P {
  if (!rows || rows.length === 0) return product;
  const live = new Map(rows.map((r) => [r.id, r.stock]));
  return { ...product, variations: product.variations.map((v) => (live.has(v.id) && Number.isInteger(live.get(v.id)) ? { ...v, stock: live.get(v.id)! } : v)) };
}

/** En iyi çaba: fn hata verirse (ör. önbellek yenileme istek kapsamı dışında çağrıldı) yutulur ve bildirilir; çağıranın işi (sipariş, stok iadesi) bozulmaz. */
export function runQuietly(fn: () => void, onError: (err: unknown) => void = () => {}): boolean {
  try {
    fn();
    return true;
  } catch (err) {
    try {
      onError(err);
    } catch {
      /* bildirim hatası da yutulur */
    }
    return false;
  }
}
