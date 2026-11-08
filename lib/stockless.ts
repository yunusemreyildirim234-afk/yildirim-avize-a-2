// "Stoksuz ürünleri vitrinde göster" kuralı için SAF yardımcılar (veritabanı yok, test edilebilir).
// Ayarlar SiteConfig.homepageConfig içinde (şemasız):
//   showStockless: boolean                          — genel anahtar (varsayılan KAPALI)
//   categorySettings[kategoriAnahtarı].stockless    — "show" | "hide" (yoksa genel ayar geçerli)
// Kural: ürün görünür ⇔ active VEYA (etkili ayar "göster" VE ürünün toplam stoğu 0). Bu kural active alanını DEĞİŞTİRMEZ.
import { categoryKey } from "./categories.ts";
import { resolveCategorySettings } from "./category-settings.ts";

export type StocklessChoice = "show" | "hide";
export interface StocklessRule {
  global: boolean;
  byCategory: Record<string, StocklessChoice>;
}
export const DEFAULT_STOCKLESS_RULE: StocklessRule = { global: false, byCategory: {} };

export function resolveStocklessRule(homepageConfig: unknown): StocklessRule {
  const cfg = homepageConfig && typeof homepageConfig === "object" && !Array.isArray(homepageConfig) ? (homepageConfig as Record<string, unknown>) : null;
  const byCategory: Record<string, StocklessChoice> = {};
  for (const [k, s] of Object.entries(resolveCategorySettings(homepageConfig))) if (s.stockless) byCategory[k] = s.stockless;
  return { global: cfg?.showStockless === true, byCategory };
}

/** Kategori anahtarı (categoryKey) için etkili ayar: kategori ayarı varsa o, yoksa genel. */
export const effectiveShow = (rule: StocklessRule, catKey: string): boolean => (rule.byCategory[catKey] ? rule.byCategory[catKey] === "show" : rule.global);

export interface VisibilityInput {
  active: boolean;
  /** Tüm varyasyonların toplam stoğu */
  totalStock: number;
  category: string;
}

/** Pasif + toplam stok 0 + etkili ayar "göster" → vitrinde "Tükendi" olarak görünür. */
export const isShownAsSoldOut = (p: VisibilityInput, rule: StocklessRule): boolean => !p.active && p.totalStock <= 0 && effectiveShow(rule, categoryKey(p.category));

/** Vitrin görünürlüğünün TEK saf tanımı (veritabanı sorgusu `visibleWhere` ile aynı kuralı uygular). */
export const isProductVisible = (p: VisibilityInput, rule: StocklessRule): boolean => p.active || isShownAsSoldOut(p, rule);

/** Hiçbir yerde "göster" yoksa kural devre dışıdır (sorgu eskisiyle aynı kalır). */
export const stocklessEnabled = (rule: StocklessRule): boolean => rule.global || Object.values(rule.byCategory).includes("show");

/** Pasif kategori yazımları için etkili "göster" olanların yazımları. rows: pasif + stoksuz ürünlerin kategori sayıları. */
export function stocklessShown(rule: StocklessRule, rows: readonly { category: string; count: number }[]): { spellings: string[]; rows: { category: string; count: number }[] } {
  const shown = rows.filter((r) => r.category.trim() && effectiveShow(rule, categoryKey(r.category)));
  return { spellings: shown.map((r) => r.category), rows: shown.map((r) => ({ category: r.category, count: r.count })) };
}

/** Pasif ve toplam stoğu 0 ürün koşulu (Prisma). */
export const SOLD_OUT_INACTIVE_WHERE = { active: false, variations: { none: { stock: { gt: 0 } } } } as const;
/** Pasif ama en az bir varyasyonu stoklu ürün koşulu (Prisma): "stoğu var ama pasif". */
export const STOCKED_INACTIVE_WHERE = { active: false, variations: { some: { stock: { gt: 0 } } } } as const;

/** Vitrinde görünür ürün koşulu (Prisma). Gösterilecek kategori yazımı yoksa yalnızca aktif ürünler (eski davranış). */
export function visibleWhere(showSpellings: readonly string[]) {
  if (showSpellings.length === 0) return { active: true } as const;
  return { OR: [{ active: true }, { variations: { none: { stock: { gt: 0 } } }, category: { in: [...showSpellings] } }] };
}
