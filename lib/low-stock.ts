// "Son N adet" stok rozeti için SAF yardımcılar (veritabanı yok, test edilebilir).
// Ayarlar SiteConfig.homepageConfig içinde (şemasız):
//   lowStockBadge: boolean      — genel anahtar (varsayılan KAPALI → site değişmez)
//   lowStockThreshold: number   — eşik, tam sayı 1..10 (varsayılan 3)
// Kural: ayar açık VE 0 < stok <= eşik → "Son N adet". Stok 0 (Tükendi) ve eşiğin üstü rozet çıkarmaz. Sahte/sabit değer yoktur.
export interface LowStockSetting {
  enabled: boolean;
  threshold: number;
}
export const MIN_LOW_STOCK = 1;
export const MAX_LOW_STOCK = 10;
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_LOW_STOCK: LowStockSetting = { enabled: false, threshold: DEFAULT_LOW_STOCK_THRESHOLD };

/** 1..10 arası tam sayıysa kendisi, değilse null. */
export const validThreshold = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= MIN_LOW_STOCK && v <= MAX_LOW_STOCK ? v : null);

export function resolveLowStock(homepageConfig: unknown): LowStockSetting {
  const cfg = homepageConfig && typeof homepageConfig === "object" && !Array.isArray(homepageConfig) ? (homepageConfig as Record<string, unknown>) : null;
  return { enabled: cfg?.lowStockBadge === true, threshold: validThreshold(cfg?.lowStockThreshold) ?? DEFAULT_LOW_STOCK_THRESHOLD };
}

/** Rozet metni ya da null (rozet yok). */
export function lowStockLabel(stock: number, setting: LowStockSetting): string | null {
  if (!setting.enabled || !Number.isFinite(stock) || stock <= 0 || stock > setting.threshold) return null;
  return `Son ${Math.floor(stock)} adet`;
}
