// Trendyol görselleri Vercel Blob'a kopyalandıktan sonra eşitlemenin kopyaları geri EZMEMESİ için SAF yardımcılar (veritabanı/ağ yok).
// Eşleme şemasız saklanır: Product.syncSnapshot.imageMap = { "<Trendyol adresi>": "<Blob adresi>" } (tools/gorsel/yaz.mjs yazar).
// planSync anlık görüntüyü { ...eski, ...yeni } ile birleştirdiği için imageMap eşitlemede korunur.
type Rec = Record<string, unknown>;

const asRec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);

/** Anlık görüntüdeki eşleme; yoksa/bozuksa boş. Yalnızca metin → metin çiftleri alınır. */
export function imageMapOf(snapshot: unknown): Record<string, string> {
  const raw = asRec(asRec(snapshot)?.imageMap);
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v) out[k] = v;
  return out;
}

/** Adres listesini eşlemeden geçirir (eşlemede olmayan adres aynen kalır), tekilleştirir. */
export function mapImages(images: readonly string[], map: Record<string, string>): string[] {
  return [...new Set(images.map((u) => map[u] ?? u))];
}

/**
 * Eşitleme planından ÖNCE: Trendyol'dan gelen görseller ve anlık görüntüdeki görseller, ürünün imageMap'iyle Blob adreslerine çevrilir.
 * Böylece değişmeyen görsel "AYNI" çıkar (Ezerek modunda bile geri ezilmez); Trendyol'a eklenen yeni görsel kendi adresiyle gelir
 * ve sonraki kopyalamada taşınır. Eşlemesi olmayan ürünlere dokunulmaz.
 */
export function applyImageMaps<I extends { mainId: string; images: string[] }, E extends { trendyolMainId: string | null; syncSnapshot: Rec | null }>(
  incoming: I[],
  existing: E[],
): { incoming: I[]; existing: E[] } {
  const maps = new Map<string, Record<string, string>>();
  const mappedExisting = existing.map((e) => {
    const map = imageMapOf(e.syncSnapshot);
    if (!e.trendyolMainId || Object.keys(map).length === 0) return e;
    maps.set(e.trendyolMainId, map);
    const snapImages = e.syncSnapshot?.images;
    if (!Array.isArray(snapImages)) return e;
    return { ...e, syncSnapshot: { ...e.syncSnapshot, images: mapImages(snapImages.filter((u): u is string => typeof u === "string"), map) } };
  });
  const mappedIncoming = incoming.map((p) => {
    const map = maps.get(p.mainId);
    return map ? { ...p, images: mapImages(p.images, map) } : p;
  });
  return { incoming: mappedIncoming, existing: mappedExisting };
}
