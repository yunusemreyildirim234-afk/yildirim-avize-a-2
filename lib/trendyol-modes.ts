// Trendyol eşitleme alan modlarının KAYITLI değeri için SAF yardımcılar (veritabanı yok, test edilebilir).
// Saklama: SiteConfig.homepageConfig.trendyolSyncModes = { STOCK: "OVERWRITE", PRICE: "SKIP", ... } (şemasız).
// Kayıtlı değer formu yalnızca DOLDURUR; eşitleme her seferinde önizleme + onay ister.
// Not: Group/Mode tipleri lib/trendyol-plan.ts ile aynıdır (o dosya salt okunur olduğu için burada yeniden bildirilmiştir).
export type SyncGroup = "STOCK" | "PRICE" | "TEXT" | "IMAGES" | "CATEGORY" | "VARIANT_INFO" | "ACTIVE";
export type SyncMode = "SKIP" | "KEEP" | "OVERWRITE";
export type SyncModes = Record<SyncGroup, SyncMode>;

export const SYNC_GROUPS: readonly SyncGroup[] = ["STOCK", "PRICE", "TEXT", "IMAGES", "CATEGORY", "VARIANT_INFO", "ACTIVE"];
const MODES: readonly SyncMode[] = ["SKIP", "KEEP", "OVERWRITE"];

/** Bugünkü varsayılan: Stok Ezerek, diğerleri Dokunma. */
export const DEFAULT_SYNC_MODES: SyncModes = { STOCK: "OVERWRITE", PRICE: "SKIP", TEXT: "SKIP", IMAGES: "SKIP", CATEGORY: "SKIP", VARIANT_INFO: "SKIP", ACTIVE: "SKIP" };

const isMode = (v: unknown): v is SyncMode => typeof v === "string" && (MODES as readonly string[]).includes(v);
const asObj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** homepageConfig.trendyolSyncModes'u güvenle çözer: eksik/geçersiz her alan varsayılana döner; fromSaved yalnızca kayıt varsa true. */
export function resolveSyncModes(homepageConfig: unknown): { modes: SyncModes; fromSaved: boolean } {
  const saved = asObj(asObj(homepageConfig)?.trendyolSyncModes);
  if (!saved) return { modes: { ...DEFAULT_SYNC_MODES }, fromSaved: false };
  const modes = { ...DEFAULT_SYNC_MODES };
  for (const g of SYNC_GROUPS) {
    const v = saved[g];
    if (isMode(v)) modes[g] = v;
  }
  return { modes, fromSaved: true };
}

/** Kaydetme girdisini sıkı doğrular: tüm gruplar ve geçerli modlar zorunlu, bilinmeyen anahtar yok. Aksi halde null. */
export function parseModesStrict(input: unknown): SyncModes | null {
  const o = asObj(input);
  if (!o) return null;
  const keys = Object.keys(o);
  if (keys.length !== SYNC_GROUPS.length || keys.some((k) => !(SYNC_GROUPS as readonly string[]).includes(k))) return null;
  const out = { ...DEFAULT_SYNC_MODES };
  for (const g of SYNC_GROUPS) {
    const v = o[g];
    if (!isMode(v)) return null;
    out[g] = v;
  }
  return out;
}

export const isDefaultModes = (m: SyncModes): boolean => SYNC_GROUPS.every((g) => m[g] === DEFAULT_SYNC_MODES[g]);
/** Ezerek seçili gruplar (uyarı için). */
export const overwriteGroups = (m: SyncModes): SyncGroup[] => SYNC_GROUPS.filter((g) => m[g] === "OVERWRITE");
