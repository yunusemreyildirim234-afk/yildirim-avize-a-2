import { unitPriceFor, type BulkRule } from "@/lib/bulk-pricing";
import { priceCart, type CartPriceLine } from "@/lib/cart-pricing";
import { shownUnitPrice, type BundleInfo } from "@/lib/cart-bundle";
import type { ComplementRule } from "@/lib/complement-pricing";
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

/** Adet=1 için adım adım düşen fiyatlar (priceCart ile; her adım öncekini içerir, kargo hariç). Kupon/havale adımı öncekinden ucuz değilse atlanır; mağaza adımı (indirimi kapalı değilse) her zaman gösterilir. */
/** Sepet satırındaki birlikte alma (tamamlayıcı) bilgisi: yalnız sunucu teklifinden gelir; kartlar sepet satırının büyük birim fiyatıyla tutarlı olur. */
export interface LadderComplement {
  rules: ComplementRule[]; // tamamlayıcının kuralları (sunucu DB)
  bundles: BundleInfo[]; // priceCart'ın bu satır için verdiği indirimli gruplar
  lineQuantity: number; // bu satırın (varyasyonun) adedi; kademe adedi (qty.quantity) renklerin toplamı olabilir
}

export function priceLadder(p: LadderProduct, ctx: LadderContext, price: number = p.basePrice, qty?: { quantity: number; tiers: BulkRule[] }, complement?: LadderComplement | null): LadderStep[] {
  // qty verilirse (sepet satırı) kademe ve adet hesaba katılır; fiyatlar BİRİM başınadır. Verilmezse adet=1, kademesiz (eski davranış).
  const n = qty?.quantity ?? 1;
  // Sepet satırında TÜM adetler aynı indirimli fiyattaysa (shownUnitPrice indirimliyi gösteriyorsa) kartlar o birim üzerinden, priceCart ile hesaplanır:
  // ana ürün adedi kadar hakkı olan sıfır fiyatlı ana ürün satırları eklenir (tutara/indirime katkısı yok), böylece haklar satırdaki gruplarla birebir aynı dağılır.
  const bundleUnit = complement && qty ? complement.bundles.length > 0 && shownUnitPrice({ unitPrice: unitPriceFor(price, qty.quantity, qty.tiers), quantity: complement.lineQuantity, bundles: complement.bundles }) < unitPriceFor(price, qty.quantity, qty.tiers) : false;
  const withBundle = bundleUnit && complement && qty ? complement : null;
  const line = {
    variationId: "ladder",
    productId: "ladder",
    price,
    quantity: withBundle ? withBundle.lineQuantity : n,
    tiers: qty?.tiers ?? [],
    couponAllowed: p.couponAllowed ?? true,
    pickupPct: p.pickupDiscountPct ?? null,
    transferPct: p.transferDiscountPct ?? null,
    ...(withBundle ? { complementOf: withBundle.rules } : {}),
  };
  const divisor = line.quantity;
  const lines: CartPriceLine[] = [line];
  if (withBundle) {
    const mainQty = new Map<string, number>();
    for (const g of withBundle.bundles) mainQty.set(g.mainProductId, (mainQty.get(g.mainProductId) ?? 0) + g.qty);
    const off = { price: 0, tiers: [] as BulkRule[], couponAllowed: false, pickupPct: 0, transferPct: 0 };
    for (const [mainProductId, quantity] of mainQty) lines.push({ variationId: `ladder-main-${mainProductId}`, productId: mainProductId, quantity, ...off });
    if (n > line.quantity) lines.push({ variationId: "ladder-pad", productId: line.productId, quantity: n - line.quantity, ...off }); // kademe adedi: aynı ürünün diğer renkleri
  }
  const net = (shippingType: string, paymentMethod: "CREDIT_CARD" | "BANK_TRANSFER", coupon: CouponRule | null) => {
    const r = priceCart({ lines, shippingType, paymentMethod, coupon, maxTotalDiscountPct: ctx.maxTotalDiscountPct });
    return { r, price: (r.total - r.shipping) / divisor, couponOk: !r.couponError && r.couponDiscount > 0 };
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
  // Mağaza satırı (indirimi bu üründe kapalı değilse) HER ZAMAN gösterilir; indirim yuvarlanınca fark etmese bile kargo ücretinin olmadığı söylenir
  if (line.pickupPct !== 0) {
    const t = pctText(line.pickupPct ?? PICKUP_DISCOUNT * 100);
    const cheaper = m.price < prev;
    steps.push({ key: "pickup", label: `+ Mağazadan teslimle (%${t})`, short: `Mağaza %${t}`, hint: cheaper ? "Beyoğlu mağazadan teslimde" : "Kargo ücreti yok, Beyoğlu mağazadan teslimde", price: m.price });
  }
  return steps;
}
