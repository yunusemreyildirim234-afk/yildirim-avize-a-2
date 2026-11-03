// Ana sayfa bölümleri: yapılandırma ayrıştırma ve liste birleştirme (saf fonksiyonlar; veritabanı yok).

export const SECTION_KEYS = ["featured", "discounted", "bestsellers"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface SectionConfig {
  count: number; // ana sayfada açıkta görünen ürün sayısı (1-48)
  pinnedIds: string[]; // başa sabitlenen ürünler (sıralı)
}

export const MAX_COUNT = 48;
export const MAX_PINNED = 60;

/** Config yokken bugünkü davranış: Öne Çıkanlar 8, İndirimliler 4, Çok Satanlar 8. */
export const DEFAULT_COUNTS: Record<SectionKey, number> = { featured: 8, discounted: 4, bestsellers: 8 };

export interface ResolvedSection extends SectionConfig {
  saved: boolean; // yönetici bu bölümü kaydetti mi (kaydedilmediyse bugünkü davranış)
}
export type ResolvedConfig = Record<SectionKey, ResolvedSection>;

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_COUNT;

/** Ham JSON'u güvenle çözer; eksik/geçersiz alanlar varsayılana düşer, hata fırlatmaz. */
export function resolveConfig(raw: unknown): ResolvedConfig {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as ResolvedConfig;
  for (const key of SECTION_KEYS) {
    const sec = obj[key];
    if (!sec || typeof sec !== "object" || Array.isArray(sec)) {
      out[key] = { count: DEFAULT_COUNTS[key], pinnedIds: [], saved: false };
      continue;
    }
    const s = sec as Record<string, unknown>;
    const pinned = Array.isArray(s.pinnedIds) ? [...new Set(s.pinnedIds.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, MAX_PINNED) : [];
    out[key] = { count: isCount(s.count) ? s.count : DEFAULT_COUNTS[key], pinnedIds: pinned, saved: true };
  }
  return out;
}

/**
 * Bölüm listesi: önce sabitlenenler (sırayla; yalnızca bölümün güncel havuzunda olanlar), ardından havuzun doğal sıralaması; tekrarlar çıkarılır.
 * `shown` ilk `count` ürün; `more` kalanlar ("Daha fazla göster"). Kaydedilmemiş bölümde `more` boştur (bugünkü davranış),
 * `legacyMore` true ise (ör. elle işaretli Öne Çıkanlar) kaydedilmemiş olsa da kalanlar gösterilir.
 */
export function composeSection<P extends { id: string }>(pool: P[], sec: ResolvedSection, legacyMore = false): { shown: P[]; more: P[] } {
  const byId = new Map(pool.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const ordered: P[] = [];
  for (const id of sec.pinnedIds) {
    const p = byId.get(id);
    if (p && !seen.has(id)) {
      seen.add(id);
      ordered.push(p);
    }
  }
  for (const p of pool) if (!seen.has(p.id)) ordered.push(p);
  const shown = ordered.slice(0, sec.count);
  return { shown, more: sec.saved || legacyMore ? ordered.slice(sec.count) : [] };
}
