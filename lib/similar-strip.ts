// "Benzer Avize Modelleri" şeridi için SAF mantık (veritabanı ve Next yok; test edilebilir).
// Liste, paylaşılan katalog satırlarından (lib/listing.ts) bellekte süzülür. Önbellek parçalanmasın diye kart okumaları
// kendi ürünümüzü İÇEREN, listeye hizalı 8'lik pencerelerle yapılır; kendi ürün pencereden bellekte çıkarılır (anahtarda ürün/sepet verisi yoktur).

export const SIMILAR_PAGE_SIZE = 8;

export interface SimilarRow {
  id: string;
  /** Ham kategori yazımı (ürün sayfası tam eşitlikle eşleştirir) */
  rc?: string;
  active?: boolean;
  /** En az bir varyasyonu stokta */
  inStock?: boolean;
  updated: number;
}

/** Aynı kategori + aktif + stokta; sıra kararlı: updatedAt azalan, id artan. Kendi ürün listede KALIR (pencere hizası için). */
export function similarList(rows: SimilarRow[], category: string): string[] {
  return rows
    .filter((r) => r.rc === category && r.active === true && r.inStock === true)
    .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => r.id);
}

/** Pencere okunur: kimlik sırası korunur, bulunamayanlar ve kendi ürün atlanır. */
function ordered<T extends { id: string }>(ids: string[], found: T[], excludeId: string): T[] {
  const byId = new Map(found.map((p) => [p.id, p]));
  return ids.flatMap((id) => (id !== excludeId && byId.has(id) ? [byId.get(id)!] : []));
}

export interface SimilarPage<T> {
  items: T[];
  /** Listede ilerlenen konum (kendi ürün de sayılır); sonraki istek buradan başlar */
  cursor: number;
  hasMore: boolean;
}

/**
 * `cursor`'dan başlayan hizalı pencereyi okur: sayfa 8 üründür; kendi ürünün bulunduğu pencere bir kez 7 ürün verir (tamamlamak için ikinci pencere okunmaz, anahtar sabit kalır).
 * Pencere (silinmiş vb. nedenle) boş çıkarsa ve liste sürüyorsa sonraki pencereye geçilir; böylece "devam var ama boş" sonuç dönmez.
 * `fetchWindow` bir penceredeki kimlikler için ürünleri döndürür (önbellekli okuma).
 */
export async function collectPage<T extends { id: string }>(
  list: string[],
  excludeId: string,
  cursor: number,
  size: number,
  fetchWindow: (ids: string[]) => Promise<T[]>
): Promise<SimilarPage<T>> {
  let cur = Math.max(0, cursor);
  const items: T[] = [];
  while (items.length === 0 && cur < list.length) {
    const ids = list.slice(cur, cur + size);
    cur += size;
    items.push(...ordered(ids, await fetchWindow(ids), excludeId));
  }
  const next = Math.min(cur, list.length);
  return { items, cursor: next, hasMore: next < list.length };
}

/** Kimliğe göre tekrar eleme: önceki öğeler korunur, yenilerden zaten olanlar atılır. */
export function mergeUnique<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((i) => i.id));
  const fresh: T[] = [];
  for (const i of next) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    fresh.push(i);
  }
  return [...prev, ...fresh];
}

/** Şerit sona yaklaştı mı: scrollLeft + clientWidth >= scrollWidth - eşik (eşik: en az 200 px, yarım görünüm genişliği). */
export function nearEnd(scrollLeft: number, clientWidth: number, scrollWidth: number): boolean {
  const threshold = Math.max(200, clientWidth / 2);
  return scrollLeft + clientWidth >= scrollWidth - threshold;
}
