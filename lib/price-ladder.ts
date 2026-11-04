import type { BulkRule } from "@/lib/bulk-pricing";
import { priceCart } from "@/lib/cart-pricing";
import { BANK_TRANSFER_DISCOUNT, PICKUP_DISCOUNT, SHIPPING_TYPES, type CouponRule } from "@/lib/pricing";
import { ladderCouponLabel } from "@/lib/coupon-code";

export interface LadderStep {
  key: "coupon" | "bank" | "pickup";
  label: string; // "<vitrin kodu> kuponuyla" / "+ Havale/EFT ile (%5)"
  short: string; // dar (mobil) kart etiketi: "<vitrin kodu>" / "Havale/EFT %5" / "Mağaza %3"
  hint: string;
  price: number;
}

export interface LadderContext {
  coupon: CouponRule | null; // vitrin kuponu; geçerli değilse null
  maxTotalDiscountPct: number | null;
}

export interface LadderProduct {
  basePrice: number;
  couponAllowed?: boolean | null;
  pickupDiscountPct?: number | null;
  transferDiscountPct?: number | null;
}

const pctText = (pct: number) => pct.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** Adet=1 için adım adım düşen fiyatlar (priceCart ile; her adım öncekini içerir, kargo hariç). Aynı kalan adımlar atlanır. */
export function priceLadder(p: LadderProduct, ctx: LadderContext, price: number = p.basePrice, qty?: { quantity: number; tiers: BulkRule[] }): LadderStep[] {
  // qty verilirse (sepet satırı) kademe ve adet hesaba katılır; fiyatlar BİRİM başınadır. Verilmezse adet=1, kademesiz (eski davranış).
  const n = qty?.quantity ?? 1;
  const line = {
    variationId: "ladder",
    productId: "ladder",
    price,
    quantity: n,
    tiers: qty?.tiers ?? [],
    couponAllowed: p.couponAllowed ?? true,
    pickupPct: p.pickupDiscountPct ?? null,
    transferPct: p.transferDiscountPct ?? null,
  };
  const net = (shippingType: string, paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER", coupon: CouponRule | null) => {
    const r = priceCart({ lines: [line], shippingType, paymentMethod, coupon, maxTotalDiscountPct: ctx.maxTotalDiscountPct });
    return { r, price: (r.total - r.shipping) / n, couponOk: !r.couponError && r.couponDiscount > 0 };
  };
  const steps: LadderStep[] = [];
  let prev = qty ? net(SHIPPING_TYPES.HOME, "CREDIT_CARD", null).price : price;
  let coupon: CouponRule | null = null;

  if (ctx.coupon && line.couponAllowed) {
    const c = net(SHIPPING_TYPES.HOME, "CREDIT_CARD", ctx.coupon);
    if (c.couponOk && c.price < prev) {
      coupon = ctx.coupon;
      steps.push({ key: "coupon", label: ladderCouponLabel(ctx.coupon.code), short: ctx.coupon.code, hint: "Sepette kodu girin", price: c.price });
      prev = c.price;
    }
  }
  const b = net(SHIPPING_TYPES.HOME, "BANK_TRANSFER", coupon);
  if (b.price < prev) {
    const t = pctText(line.transferPct ?? BANK_TRANSFER_DISCOUNT * 100);
    steps.push({ key: "bank", label: `+ Havale/EFT ile (%${t})`, short: `Havale/EFT %${t}`, hint: "Havale/EFT ödemede", price: b.price });
    prev = b.price;
  }
  const m = net(SHIPPING_TYPES.PICKUP, "BANK_TRANSFER", coupon);
  if (m.price < prev) {
    const t = pctText(line.pickupPct ?? PICKUP_DISCOUNT * 100);
    steps.push({ key: "pickup", label: `+ Mağazadan teslimle (%${t})`, short: `Mağaza %${t}`, hint: "Beyoğlu mağazadan teslimde", price: m.price });
  }
  return steps;
}
