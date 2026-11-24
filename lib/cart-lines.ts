import type { BulkRule } from "@/lib/bulk-pricing";
import type { CartPriceLine } from "@/lib/cart-pricing";
import type { ComplementRule } from "@/lib/complement-pricing";

/** Sepet kaleminin fiyat hesabı için gereken alanlar (CartContext.CartItem bunun üst kümesidir). */
export interface PriceableCartItem {
  productId: string;
  variationId: string;
  price: number;
  quantity: number;
  bulk?: BulkRule[] | null;
  rules?: { couponAllowed: boolean; pickupPct: number | null; transferPct: number | null; complementOf?: ComplementRule[] };
}

/** Sepet kalemlerini ortak fiyat hesabı (lib/cart-pricing.ts) girdisine çevirir. `complementOf` yoksa sonuç eskisiyle aynıdır. */
export const cartPriceLines = (cart: PriceableCartItem[]): CartPriceLine[] =>
  cart.map((i) => ({
    variationId: i.variationId,
    productId: i.productId,
    price: i.price,
    quantity: i.quantity,
    tiers: i.bulk ?? [],
    couponAllowed: i.rules?.couponAllowed ?? true,
    pickupPct: i.rules?.pickupPct ?? null,
    transferPct: i.rules?.transferPct ?? null,
    ...(i.rules?.complementOf?.length ? { complementOf: i.rules.complementOf } : {}),
  }));

/**
 * Kalemde `rules.complementOf` hiç yoksa (ürün sayfasından/hızlı eklemeyle eklenmiş, kural bilgisi henüz sunucudan alınmamış)
 * sunucu teklifindeki tamamlayıcı kuralını yalnız karşılaştırma için doldurur; fiyat/kademe/oran alanlarına dokunmaz.
 * Böylece "Bazı fiyatlar güncellendi" yalnızca bilinmeyen tamamlayıcı indirimi yüzünden çıkmaz. Doldurulacak kalem yoksa aynı diziyi döner.
 */
export function fillComplementRules<T extends PriceableCartItem>(cart: T[], quoteLines: { variationId: string; rules?: { complementOf?: ComplementRule[] } }[]): T[] {
  const byId = new Map(quoteLines.map((l) => [l.variationId, l.rules?.complementOf ?? []]));
  let changed = false;
  const next = cart.map((i) => {
    const co = byId.get(i.variationId);
    if (!co?.length || i.rules?.complementOf !== undefined) return i;
    changed = true;
    return { ...i, rules: { couponAllowed: i.rules?.couponAllowed ?? true, pickupPct: i.rules?.pickupPct ?? null, transferPct: i.rules?.transferPct ?? null, complementOf: co } };
  });
  return changed ? next : cart;
}
