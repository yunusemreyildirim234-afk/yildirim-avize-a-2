import { unitPriceFor, type BulkRule } from "@/lib/bulk-pricing";
import {
  BANK_TRANSFER_DISCOUNT,
  DEFAULT_COUPON_CODE,
  FREE_SHIPPING_THRESHOLD,
  PICKUP_DISCOUNT,
  SHIPPING_COST,
  SHIPPING_TYPES,
  couponDiscountFor,
  type CouponRule,
} from "@/lib/pricing";

// TEK HESAPLAMA: /api/order, /api/cart/quote, sepet (yedek hesap) ve ürün sayfası bu fonksiyonu kullanır.
// Saf fonksiyondur (veritabanı yok). Varsayılan ayarlarda (tüm ürünler couponAllowed, özel oran yok) sonuç,
// eski "birim fiyat × adet + computeTotals" hesabıyla kuruşu kuruşuna aynıdır.

export interface ProductRules {
  couponAllowed: boolean;
  pickupPct: number | null;
  transferPct: number | null;
}

/** Bir indirim o ürün için kapalıysa / özel oran varsa gösterilecek kısa notlar. */
export function ruleNotes(r: ProductRules | null | undefined): string[] {
  if (!r) return [];
  const notes: string[] = [];
  if (!r.couponAllowed) notes.push(`Bu üründe ${DEFAULT_COUPON_CODE} kuponu kullanılamamaktadır.`);
  if (r.pickupPct === 0) notes.push("Bu üründe mağazadan teslim indirimi kullanılamamaktadır.");
  else if (r.pickupPct !== null && Math.round(PICKUP_DISCOUNT * 100) !== r.pickupPct) notes.push(`Mağazadan teslimde %${r.pickupPct.toLocaleString("tr-TR")} indirim.`);
  if (r.transferPct === 0) notes.push("Bu üründe Havale/EFT indirimi kullanılamamaktadır.");
  else if (r.transferPct !== null && Math.round(BANK_TRANSFER_DISCOUNT * 100) !== r.transferPct) notes.push(`Havale/EFT'de %${r.transferPct.toLocaleString("tr-TR")} indirim.`);
  return notes;
}

export const COUPON_UNAVAILABLE = "Sepetinizdeki ürünlerde bu kod kullanılamamaktadır";

export interface CartPriceLine {
  variationId: string;
  productId: string;
  price: number; // güncel birim fiyat (taban + varyasyon farkı), kademe öncesi
  quantity: number;
  tiers: BulkRule[];
  couponAllowed: boolean;
  pickupPct: number | null; // null: varsayılan, 0: bu üründe yok
  transferPct: number | null;
}

export interface PricedLine extends CartPriceLine {
  unitPrice: number; // kademe sonrası birim fiyat
  lineTotal: number; // unitPrice × quantity (yuvarlanmaz)
  tierQty: number; // kademeyi belirleyen toplam adet (aynı ürünün tüm renkleri)
}

export interface CartPricing {
  lines: PricedLine[];
  itemsTotal: number;
  shipping: number;
  couponDiscount: number;
  pickupDiscount: number;
  bankDiscount: number;
  total: number;
  couponError?: string;
}

/** Yüzdeyi orana çevirir; varsayılan orana eşitse varsayılan sabit aynen kullanılır (kayan nokta sapması olmasın). */
const rateOf = (pct: number | null, def: number) => (pct === null ? def : Math.round(def * 100) === pct ? def : pct / 100);

const groupBy = <T,>(items: T[], key: (t: T) => number) => {
  const map = new Map<number, T[]>();
  for (const i of items) map.set(key(i), [...(map.get(key(i)) ?? []), i]);
  return [...map.entries()];
};

export function priceCart(opts: {
  lines: CartPriceLine[];
  shippingType: string;
  paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER";
  coupon?: CouponRule | null;
}): CartPricing {
  // 1) Kademe: aynı ürünün tüm renk/varyasyon satırlarının TOPLAM adedine göre
  const qtyByProduct = new Map<string, number>();
  for (const l of opts.lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.quantity);
  const lines: PricedLine[] = opts.lines.map((l) => {
    const tierQty = qtyByProduct.get(l.productId) ?? l.quantity;
    const unitPrice = unitPriceFor(l.price, tierQty, l.tiers);
    return { ...l, tierQty, unitPrice, lineTotal: unitPrice * l.quantity };
  });
  const itemsTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // 2) Kupon: yalnızca couponAllowed kalemlerin ara toplamı üzerinden
  let couponError: string | undefined;
  let couponRaw = 0;
  const eligible = lines.filter((l) => l.couponAllowed);
  if (opts.coupon) {
    const applicable = eligible.filter((l) => !opts.coupon!.productId || l.productId === opts.coupon!.productId);
    if (applicable.length === 0) couponError = COUPON_UNAVAILABLE;
    else couponRaw = couponDiscountFor(opts.coupon, eligible.map((l) => ({ productId: l.productId, lineTotal: l.lineTotal })));
  }
  const isPickup = opts.shippingType === SHIPPING_TYPES.PICKUP;
  const shipping = isPickup || itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const couponDiscount = Math.min(itemsTotal, Math.max(0, couponRaw));

  // 3) Mağazadan teslim: ürünün oranına göre gruplanır, her grup kendi içinde yuvarlanır
  const pickupGroups = groupBy(lines, (l) => rateOf(l.pickupPct, PICKUP_DISCOUNT));
  const pickupByGroup = pickupGroups.map(([rate, ls]) => (isPickup ? Math.round(ls.reduce((s, l) => s + l.lineTotal, 0) * rate) : 0));
  const pickupDiscount = pickupGroups.length === 1 && isPickup ? Math.round(itemsTotal * pickupGroups[0][0]) : pickupByGroup.reduce((a, b) => a + b, 0);

  // 4) Havale/EFT: kupon ve mağaza indirimi düşülmüş tutar (kargo dahil) üzerinden, ürünün oranına göre
  const afterDiscounts = Math.max(0, itemsTotal + shipping - couponDiscount - pickupDiscount);
  let bankDiscount = 0;
  if (opts.paymentMethod === "BANK_TRANSFER") {
    const bankGroups = groupBy(lines, (l) => rateOf(l.transferPct, BANK_TRANSFER_DISCOUNT));
    if (bankGroups.length === 1) {
      bankDiscount = Math.round(afterDiscounts * bankGroups[0][0]);
    } else {
      // Karışık oranlarda her satırın payı (ürün + kargo − kupon − mağaza indirimi payı) kendi oranıyla yuvarlanır
      const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
      const pickupShare = new Map<string, number>();
      pickupGroups.forEach(([, ls], i) => {
        const gt = ls.reduce((s, l) => s + l.lineTotal, 0);
        for (const l of ls) pickupShare.set(l.variationId, gt > 0 ? (pickupByGroup[i] * l.lineTotal) / gt : 0);
      });
      const baseOf = (l: PricedLine) =>
        l.lineTotal +
        (itemsTotal > 0 ? (shipping * l.lineTotal) / itemsTotal : 0) -
        (l.couponAllowed && eligibleTotal > 0 ? (couponDiscount * l.lineTotal) / eligibleTotal : 0) -
        (pickupShare.get(l.variationId) ?? 0);
      bankDiscount = bankGroups.reduce((sum, [rate, ls]) => sum + Math.round(Math.max(0, ls.reduce((s, l) => s + baseOf(l), 0)) * rate), 0);
    }
  }

  return { lines, itemsTotal, shipping, couponDiscount, pickupDiscount, bankDiscount, total: Math.max(0, afterDiscounts - bankDiscount), couponError };
}
