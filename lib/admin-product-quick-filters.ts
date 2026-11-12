// Admin ürün listesi hızlı süzgeçleri: yüklü veri üzerinde istemci tarafı (yeni sorgu yok). Saf, bağımlılıksız.
import { isPurchasablePrice } from "./purchasable.ts";

export type QuickFilterKey = "outofstock" | "zeroprice" | "inactive";

interface QuickFilterProduct {
  basePrice: number;
  active?: boolean;
  variations: { stock: number }[];
}

export const QUICK_FILTER_LABELS: Record<QuickFilterKey, string> = { outofstock: "Stoksuz", zeroprice: "Fiyatı 0", inactive: "Pasif" };

export const isQuickFilterKey = (key: string): key is QuickFilterKey => key in QUICK_FILTER_LABELS;

// Stoksuz: hiç varyasyonu olmayan ya da tüm varyasyon stokları 0 (veya eksi) olan ürün
export const isOutOfStock = (p: QuickFilterProduct) => p.variations.every((v) => v.stock <= 0);
export const hasZeroPrice = (p: QuickFilterProduct) => !isPurchasablePrice(p.basePrice);
export const isInactive = (p: QuickFilterProduct) => p.active === false;

export function quickFilterTest(key: QuickFilterKey, p: QuickFilterProduct): boolean {
  return key === "outofstock" ? isOutOfStock(p) : key === "zeroprice" ? hasZeroPrice(p) : isInactive(p);
}
