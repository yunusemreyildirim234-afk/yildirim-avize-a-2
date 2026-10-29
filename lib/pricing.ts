export const DEFAULT_COUPON_CODE = "YILDIRIM5";

export const SHIPPING_COST = 100;
export const FREE_SHIPPING_THRESHOLD = 350;
export const BANK_TRANSFER_DISCOUNT = 0.05;
export const PICKUP_DISCOUNT = 0.03;

export const SHIPPING_TYPES = {
  PICKUP: "BEYOGLU_MAGAZA_TESLIM",
  HOME: "STANDART_KARGO",
} as const;

export const SHIPPING_LABELS: Record<string, string> = {
  BEYOGLU_MAGAZA_TESLIM: "Mağazadan Teslim",
  STANDART_KARGO: "Adrese Teslim",
};

export interface CouponRule {
  code: string;
  discountPercent: number;
  productId: string | null; // null: tüm sepet
}

export interface PriceLine {
  productId: string;
  lineTotal: number;
}

/** Kuponun uygulanacağı tutar üzerinden yüzde indirim (ürüne özelse yalnızca o ürünün satırları). */
export function couponDiscountFor(rule: CouponRule | null | undefined, lines: PriceLine[]): number {
  if (!rule) return 0;
  const base = lines.reduce((sum, l) => (rule.productId && l.productId !== rule.productId ? sum : sum + l.lineTotal), 0);
  return Math.round((base * rule.discountPercent) / 100);
}

export interface Totals {
  shipping: number;
  couponDiscount: number;
  pickupDiscount: number;
  bankDiscount: number;
  total: number;
}

// Hem sepet ekranı hem sunucu (sipariş/PayTR tutarı) aynı hesabı kullanır
export function computeTotals(opts: {
  itemsTotal: number;
  shippingType: string;
  couponDiscount?: number;
  paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER";
}): Totals {
  const isPickup = opts.shippingType === SHIPPING_TYPES.PICKUP;
  const shipping = isPickup || opts.itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const couponDiscount = Math.min(opts.itemsTotal, Math.max(0, opts.couponDiscount ?? 0));

  // Mağazadan teslim indirimi kuponla birlikte uygulanır (her ikisi de ürün tutarı üzerinden)
  const pickupDiscount = isPickup ? Math.round(opts.itemsTotal * PICKUP_DISCOUNT) : 0;

  const afterDiscounts = Math.max(0, opts.itemsTotal + shipping - couponDiscount - pickupDiscount);
  const bankDiscount = opts.paymentMethod === "BANK_TRANSFER" ? Math.round(afterDiscounts * BANK_TRANSFER_DISCOUNT) : 0;

  return { shipping, couponDiscount, pickupDiscount, bankDiscount, total: Math.max(0, afterDiscounts - bankDiscount) };
}
