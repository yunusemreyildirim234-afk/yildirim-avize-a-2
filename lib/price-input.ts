// Yönetici fiyat girdisi için tek doğrulama yeri (SAF; içe aktarma yok, node --test doğrudan yükler).

export const MAX_PRICE = 10_000_000;

const hasMax2Decimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** Satış fiyatı: 0 < fiyat ≤ 10.000.000, en çok 2 ondalık. */
export const validPrice = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_PRICE && hasMax2Decimals(n);

/** Renk fiyat farkı: 0 ≤ fark ≤ 10.000.000, en çok 2 ondalık. */
export const validExtraPrice = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_PRICE && hasMax2Decimals(n);

export const PRICE_ERROR = "Fiyat 0'dan büyük, en fazla 10.000.000 ₺ ve en çok 2 ondalıklı olmalı.";
export const EXTRA_PRICE_ERROR = "Fiyat farkı 0 veya daha büyük, en fazla 10.000.000 ₺ ve en çok 2 ondalıklı olmalı.";

/** Toplu indirim sonrası birim fiyat (kuruşa yuvarlı); 0 veya altı sonuç çağıran tarafından atlanır. */
export function discountedPrice(original: number, mode: "PERCENT" | "FIXED", value: number): number {
  const next = mode === "PERCENT" ? original * (1 - value / 100) : original - value;
  return Math.round(next * 100) / 100;
}
