// Sepet "kazanç" gösterimi (YALNIZCA gösterim; fiyat kuralı değildir, lib/cart-pricing.ts sonucunu okur).
// Karşılaştırma fiyatı: ürünün liste fiyatı (varyasyon farkıyla) güncel birim fiyattan büyükse o, değilse kademe öncesi birim fiyat.

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Satırın karşılaştırma (üstü çizili) birim fiyatı. */
export function referenceUnit(item: { price: number; listPrice?: number | null }): number {
  return item.listPrice && item.listPrice > item.price ? item.listPrice : item.price;
}

/** Bir satırın kazancı: (karşılaştırma birimi − ödenen birim) × adet. */
export function lineSavings(item: { price: number; listPrice?: number | null; quantity: number }, unitPrice: number): number {
  return Math.max(0, r2((referenceUnit(item) - unitPrice) * item.quantity));
}

/**
 * Toplam kazanç = liste toplamı − ödenecek ÜRÜN tutarı (Toplam Tutar − kargo).
 * Kargo ücretsizliği kazanca girmez; kargo ücretliyse toplamdan düşülür. Kazanç yoksa 0.
 */
export function totalSavings(items: { price: number; listPrice?: number | null; quantity: number }[], total: number, shipping: number): number {
  const listTotal = items.reduce((s, i) => s + referenceUnit(i) * i.quantity, 0);
  return Math.max(0, r2(listTotal - (total - shipping)));
}
