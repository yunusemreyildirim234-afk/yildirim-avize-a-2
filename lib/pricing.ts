export type Coupon = { type: "percent" | "fixed"; value: number };

// Geçerli tek promosyon kodu
export const COUPONS: Record<string, Coupon> = {
  YILDIRIM5: { type: "percent", value: 5 },
};

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
  couponCode?: string | null;
  paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER";
}): Totals {
  const isPickup = opts.shippingType === SHIPPING_TYPES.PICKUP;
  const shipping = isPickup || opts.itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const coupon = opts.couponCode ? COUPONS[opts.couponCode.toUpperCase()] : undefined;

  let couponDiscount = 0;
  if (coupon) {
    couponDiscount =
      coupon.type === "percent"
        ? Math.round((opts.itemsTotal * coupon.value) / 100)
        : Math.min(opts.itemsTotal, coupon.value);
  }

  // Mağazadan teslim indirimi kuponla birlikte uygulanır (her ikisi de ürün tutarı üzerinden)
  const pickupDiscount = isPickup ? Math.round(opts.itemsTotal * PICKUP_DISCOUNT) : 0;

  const afterDiscounts = Math.max(0, opts.itemsTotal + shipping - couponDiscount - pickupDiscount);
  const bankDiscount = opts.paymentMethod === "BANK_TRANSFER" ? Math.round(afterDiscounts * BANK_TRANSFER_DISCOUNT) : 0;

  return { shipping, couponDiscount, pickupDiscount, bankDiscount, total: Math.max(0, afterDiscounts - bankDiscount) };
}
