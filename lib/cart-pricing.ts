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

export interface CapInfo {
  tierPct: number; // ürünün adet kademesi indirimi (% liste)
  remainingPct: number; // kupon+mağaza+Havale için kalan pay (% liste)
  capPct: number;
}

export interface PricedLine extends CartPriceLine {
  capInfo?: CapInfo; // yalnızca üst sınır nedeniyle kısılma olduysa
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
  maxTotalDiscountPct?: number | null; // toplam indirim üst sınırı % (boş/null: sınırsız)
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
    const applicableTotal = applicable.reduce((sum, l) => sum + l.lineTotal, 0);
    if (applicable.length === 0) couponError = COUPON_UNAVAILABLE;
    else if (opts.coupon.minCartTotal && applicableTotal < opts.coupon.minCartTotal) {
      couponError = `Bu kod için minimum sepet tutarı ${opts.coupon.minCartTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
    } else couponRaw = couponDiscountFor(opts.coupon, eligible.map((l) => ({ productId: l.productId, lineTotal: l.lineTotal })));
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

  const result: CartPricing = { lines, itemsTotal, shipping, couponDiscount, pickupDiscount, bankDiscount, total: Math.max(0, afterDiscounts - bankDiscount), couponError };

  // 5) Toplam indirim üst sınırı (ÜRÜN bazlı): bir ürünün adet kademesi indirimi + kupon + mağaza + Havale payı, ürünün liste tutarının %cap'ini aşamaz.
  //    Aşan ürünün kupon/mağaza/Havale payları orantılı kısılır (kuruşa aşağı); adet kademesi fiyatı ASLA kısılmaz.
  const cap = opts.maxTotalDiscountPct;
  if (cap !== null && cap !== undefined && cap >= 0 && cap < 100) {
    const applicable = opts.coupon && !couponError ? eligible.filter((l) => !opts.coupon!.productId || l.productId === opts.coupon!.productId) : [];
    const applicableTotal = applicable.reduce((sum, l) => sum + l.lineTotal, 0);
    // Satır payları (toplamlar mevcut hesapla aynıdır; yalnızca ürünlere dağıtılır)
    const couponPart = lines.map((l) => (applicableTotal > 0 && applicable.includes(l) ? (couponDiscount * l.lineTotal) / applicableTotal : 0));
    const pickupPart = lines.map(() => 0);
    pickupGroups.forEach(([, ls], gi) => {
      const gt = ls.reduce((sum, l) => sum + l.lineTotal, 0);
      for (const l of ls) pickupPart[lines.indexOf(l)] = gt > 0 ? (pickupByGroup[gi] * l.lineTotal) / gt : 0;
    });
    const bankPart = lines.map(() => 0);
    if (bankDiscount > 0) {
      const w = lines.map((l, i) => {
        const base = l.lineTotal + (itemsTotal > 0 ? (shipping * l.lineTotal) / itemsTotal : 0) - couponPart[i] - pickupPart[i];
        return Math.max(0, base) * rateOf(l.transferPct, BANK_TRANSFER_DISCOUNT);
      });
      const wSum = w.reduce((a, b) => a + b, 0);
      if (wSum > 0) w.forEach((x, i) => (bankPart[i] = (bankDiscount * x) / wSum));
    }

    let clippedAny = false;
    const byProduct = new Map<string, number[]>();
    lines.forEach((l, i) => byProduct.set(l.productId, [...(byProduct.get(l.productId) ?? []), i]));
    for (const idxs of byProduct.values()) {
      const L = idxs.reduce((sum, i) => sum + lines[i].price * lines[i].quantity, 0);
      const T = L - idxs.reduce((sum, i) => sum + lines[i].lineTotal, 0);
      const H = Math.max(0, (cap * L) / 100 - T);
      const extra = idxs.reduce((sum, i) => sum + couponPart[i] + pickupPart[i] + bankPart[i], 0);
      if (extra <= H + 1e-9) continue;
      clippedAny = true;
      const k = extra > 0 ? H / extra : 0;
      const cut = (x: number) => Math.floor(x * k * 100 + 1e-9) / 100;
      for (const i of idxs) {
        couponPart[i] = cut(couponPart[i]);
        pickupPart[i] = cut(pickupPart[i]);
        bankPart[i] = cut(bankPart[i]);
        lines[i].capInfo = { tierPct: L > 0 ? (T / L) * 100 : 0, remainingPct: L > 0 ? (H / L) * 100 : 0, capPct: cap };
      }
    }
    if (clippedAny) {
      const r2 = (x: number) => Math.round(x * 100) / 100;
      const sum = (a: number[]) => r2(a.reduce((x, y) => x + y, 0));
      result.couponDiscount = sum(couponPart);
      result.pickupDiscount = sum(pickupPart);
      result.bankDiscount = sum(bankPart);
      result.total = Math.max(0, r2(itemsTotal + shipping - result.couponDiscount - result.pickupDiscount - result.bankDiscount));
    }
  }
  return result;
}

/** Üst sınır nedeniyle kısılan ürün için sepet satırı mesajı. */
export function capMessage(c: CapInfo): string {
  const f = (x: number) => x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const floor2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;
  if (c.remainingPct > 0.005) {
    return `Bu üründe adet indirimi %${f(c.tierPct)} uygulandığı için kupon, mağazadan teslim ve Havale indirimlerinden toplamda en fazla %${f(floor2(c.remainingPct))} daha yararlanabilirsiniz (bir üründe toplam indirim en fazla %${f(c.capPct)}).`;
  }
  return "Bu üründe adet indirimi uygulandığı için kupon, mağazadan teslim ve Havale indirimleri ek olarak uygulanmaz.";
}

/** Seçili teslimat/ödeme indirimleri bu sepette fiilen uygulanıyor mu? (başlık yazılarındaki "(bu sepette uygulanmaz)" için) */
export function discountsApplied(opts: Omit<Parameters<typeof priceCart>[0], "shippingType" | "paymentMethod">) {
  const pickup = priceCart({ ...opts, shippingType: SHIPPING_TYPES.PICKUP, paymentMethod: "CREDIT_CARD" }).pickupDiscount > 0;
  const transfer = priceCart({ ...opts, shippingType: SHIPPING_TYPES.HOME, paymentMethod: "BANK_TRANSFER" }).bankDiscount > 0;
  return { pickup, transfer };
}
