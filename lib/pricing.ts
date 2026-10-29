export type Coupon = { type: "percent" | "fixed"; value: number };

// Geçerli tek promosyon kodu
export const COUPONS: Record<string, Coupon> = {
  YILDIRIM5: { type: "percent", value: 5 },
};

export const SHIPPING_COST = 250;
export const BANK_TRANSFER_DISCOUNT = 0.05;

export interface Totals {
  shipping: number;
  couponDiscount: number;
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
  const shipping = opts.shippingType === "BEYOGLU_MAGAZA_TESLIM" ? 0 : SHIPPING_COST;
  const coupon = opts.couponCode ? COUPONS[opts.couponCode.toUpperCase()] : undefined;

  let couponDiscount = 0;
  if (coupon) {
    couponDiscount =
      coupon.type === "percent"
        ? Math.round((opts.itemsTotal * coupon.value) / 100)
        : Math.min(opts.itemsTotal, coupon.value);
  }

  const afterCoupon = Math.max(0, opts.itemsTotal + shipping - couponDiscount);
  const bankDiscount = opts.paymentMethod === "BANK_TRANSFER" ? Math.round(afterCoupon * BANK_TRANSFER_DISCOUNT) : 0;

  return { shipping, couponDiscount, bankDiscount, total: Math.max(0, afterCoupon - bankDiscount) };
}
