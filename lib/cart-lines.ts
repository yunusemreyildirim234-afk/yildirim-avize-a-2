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
