// Tamamlayıcı ürün ayarları ve doğrulama yardımcıları (saf). Sunucu doğrulaması, istemci girişi ve
// veritabanı CHECK kuralı (SiteConfig_complementSuggestCount_check: NULL veya 0-12) aynı sayıları kullanır.

export const DEFAULT_SUGGEST_COUNT = 4;
export const MAX_SUGGEST_COUNT = 12;
/** Bir ana ürüne en çok bağlanabilecek tamamlayıcı sayısı. */
export const MAX_COMPLEMENTS_PER_MAIN = MAX_SUGGEST_COUNT;

export const SUGGEST_COUNT_ERROR = `Öneri sayısı 0 ile ${MAX_SUGGEST_COUNT} arasında bir tam sayı olmalıdır (boş: ${DEFAULT_SUGGEST_COUNT}).`;

/** Yönetici girişi → saklanacak değer. Boş/null → null (varsayılan); geçersiz → hata mesajı. */
export function parseSuggestCount(input: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (input === null || input === undefined || (typeof input === "string" && input.trim() === "")) return { ok: true, value: null };
  const n = typeof input === "number" ? input : typeof input === "string" && /^\d+$/.test(input.trim()) ? Number(input.trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > MAX_SUGGEST_COUNT) return { ok: false, error: SUGGEST_COUNT_ERROR };
  return { ok: true, value: n };
}

/** Saklı değer → gösterilecek kart sayısı (NULL: 4, 0: kapalı). */
export function resolveSuggestCount(stored: number | null | undefined): number {
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 0) return DEFAULT_SUGGEST_COUNT;
  return Math.min(stored, MAX_SUGGEST_COUNT);
}

/** Bağ indirimi değeri doğrulaması (§4.3). Geçerliyse null, değilse Türkçe hata. */
export function validateComplementDiscount(type: unknown, value: unknown): string | null {
  if (type !== "PERCENT" && type !== "FIXED") return "İndirim türü yüzde veya TL olmalıdır.";
  if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0)) return "İndirim 0'dan büyük olmalıdır.";
  if (type === "PERCENT" && value >= 100) return "Yüzde 100'ün altında olmalıdır.";
  if (type === "FIXED" && Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return "TL indirimi en çok 2 ondalık içerebilir.";
  return null;
}

/** TL indirimi tamamlayıcının en düşük fiyatından küçük olmalı (aksi hâlde bağ kurulmaz). */
export function fixedDiscountFits(value: number, lowestPrice: number): boolean {
  return value < lowestPrice;
}

export interface SuggestCandidate {
  productId: string;
  active: boolean;
  purchasable: boolean; // fiyatı geçerli
  inStock: boolean; // en az bir varyasyonunda stok
  position: number;
  createdAt: number; // sıralama için (ms)
}

/** Öneri listesi: pasif/stoksuz/fiyatsız ve sepetteki ürünler elenir (sayıya girmez), position sonra eklenme sırası, ayar kadar kart. */
export function pickSuggestions<T extends SuggestCandidate>(cands: T[], cartProductIds: ReadonlySet<string>, stored: number | null | undefined): T[] {
  const limit = resolveSuggestCount(stored);
  if (limit === 0) return [];
  return cands
    .filter((c) => c.active && c.purchasable && c.inStock && !cartProductIds.has(c.productId))
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
    .slice(0, limit);
}
