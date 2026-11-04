// Ana sayfa "Aydınlatma Koleksiyonları" satırı: yönetici seçimi + sıra (saf fonksiyonlar; veritabanı yok, test edilebilir).
// Seçim SiteConfig.homepageConfig.collections içinde kategori anahtarları (categoryKey) olarak saklanır; yoksa/boşsa varsayılan.

export const MAX_COLLECTIONS = 24;
export const MAX_KEY_LENGTH = 80;

type Entry = { key: string; count: number };

/** Ham JSON'dan kayıtlı anahtarlar; geçersiz değerler atılır, tekrarlar çıkarılır. Hata fırlatmaz. */
export function resolveCollectionKeys(raw: unknown): string[] {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const v = obj?.collections;
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= MAX_KEY_LENGTH))].slice(0, MAX_COLLECTIONS);
}

/** Sunucu doğrulaması (kayıt): dizi, en fazla MAX_COLLECTIONS, tekil, boş olmayan metinler. */
export function validateCollectionKeys(raw: unknown): { ok: true; keys: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Koleksiyonlar bir liste olmalıdır." };
  if (raw.length > MAX_COLLECTIONS) return { ok: false, error: `En fazla ${MAX_COLLECTIONS} koleksiyon seçilebilir.` };
  if (raw.some((x) => typeof x !== "string" || !x.trim() || x.length > MAX_KEY_LENGTH)) return { ok: false, error: "Koleksiyon seçimi geçersiz." };
  const keys = raw as string[];
  if (new Set(keys).size !== keys.length) return { ok: false, error: "Aynı koleksiyon iki kez eklenemez." };
  return { ok: true, keys };
}

/**
 * Ana sayfada gösterilecek koleksiyonlar. Ürünsüz (count 0) kategori hiç görünmez.
 * Kayıtlı seçim yoksa: tüm kategoriler listedeki sırayla (sabit kategoriler + yeni eklenenler).
 * Kayıtlı seçim varsa: yalnızca seçilenler, seçim sırasıyla; silinmiş/ürünsüz olanlar atlanır. Hiçbiri kalmazsa varsayılana düşer.
 */
export function pickCollections<E extends Entry>(list: readonly E[], savedKeys: readonly string[]): E[] {
  const available = list.filter((c) => c.count > 0);
  if (savedKeys.length === 0) return available;
  const byKey = new Map(available.map((c) => [c.key, c]));
  const chosen: E[] = [];
  for (const k of savedKeys) {
    const c = byKey.get(k);
    if (c && !chosen.includes(c)) chosen.push(c);
  }
  return chosen.length > 0 ? chosen : available;
}

/** Yönetim formu açılışı: kayıtlı seçim varsa onun (geçerli) sırası, yoksa tüm uygun kategoriler. `custom` kayıtlı seçim olup olmadığını söyler. */
export function editorSelection<E extends Entry>(list: readonly E[], savedKeys: readonly string[]): { selected: string[]; custom: boolean } {
  const available = list.filter((c) => c.count > 0);
  const valid = savedKeys.filter((k) => available.some((c) => c.key === k));
  return valid.length > 0 ? { selected: valid, custom: true } : { selected: available.map((c) => c.key), custom: false };
}

/** ▲▼: i. öğeyi d yönünde taşır; sınır dışıysa aynı dizi. */
export function moveKey(keys: readonly string[], i: number, d: -1 | 1): string[] {
  const j = i + d;
  if (i < 0 || i >= keys.length || j < 0 || j >= keys.length) return [...keys];
  const next = [...keys];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
