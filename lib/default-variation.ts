/**
 * Ürün sayfasında başta seçili gelen seçenek. Kart fiyatı `basePrice` olduğundan (ek fiyatsız seçenek),
 * sayfa da aynı fiyatla açılsın diye: stoklu seçenekler arasında ek fiyatı EN DÜŞÜK olan; eşitlikte ilki.
 * Hiç stoklu seçenek yoksa ek fiyatı en düşük olan (eşitlikte ilki); seçenek yoksa null.
 * Yalnızca hangi seçeneğin seçileceğini belirler; fiyat hesabına dokunmaz.
 */
export function pickDefaultOption<V extends { stock: number; extraPrice: number }>(variations: V[]): V | null {
  const cheapest = (list: V[]): V | null => list.reduce<V | null>((best, v) => (best === null || v.extraPrice < best.extraPrice ? v : best), null);
  return cheapest(variations.filter((v) => v.stock > 0)) ?? cheapest(variations);
}
