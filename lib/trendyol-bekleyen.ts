import type { ProductPlan } from "@/lib/trendyol-plan";

/** Sitede stoğu düşülmüş ve henüz kapanmamış (Trendyol'a yansımamış olabilecek) siparişlerin durumları. */
export const OPEN_ORDER_STATUSES = ["AWAITING_PAYMENT", "PENDING_NEW", "PENDING", "READY_FOR_PICKUP"] as const;

export interface PendingItem {
  variationId: string;
  quantity: number;
  order: { status: string; stockDeducted: boolean };
}

/** variationId → sitede bekleyen toplam adet (yalnız stockDeducted = true ve açık durumdaki siparişler). Saf: yalnızca UYARI içindir, stok formülünü etkilemez. */
export function sumPendingByVariation(items: PendingItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    if (!i.order.stockDeducted || !(OPEN_ORDER_STATUSES as readonly string[]).includes(i.order.status)) continue;
    out[i.variationId] = (out[i.variationId] ?? 0) + i.quantity;
  }
  return out;
}

/** Planda stok değişikliği olan varyasyonların (kimliği olanlar) kimlikleri. */
export function stockChangeVariationIds(products: Pick<ProductPlan, "variations">[]): string[] {
  const ids = new Set<string>();
  for (const p of products) for (const v of p.variations) if (v.id && v.fields.some((f) => f.alan === "stock")) ids.add(v.id);
  return [...ids];
}

/** Önizleme satırları barkodla eşlenir: barkod → bekleyen adet (yalnız stok değişikliği olan ve adedi > 0 olanlar). */
export function pendingByBarcode(products: Pick<ProductPlan, "variations">[], byVariation: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of products) {
    for (const v of p.variations) {
      const n = v.id ? byVariation[v.id] ?? 0 : 0;
      if (n > 0 && v.fields.some((f) => f.alan === "stock")) out[v.barcode] = n;
    }
  }
  return out;
}

export const pendingWarning = (n: number) => `Sitede bekleyen ${n} adet sipariş var, Trendyol'da düşüldüğünden emin olun.`;
