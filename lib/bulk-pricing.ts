// Adet bazlı indirim: istemci ve sunucuda aynı hesabı kullanır (sunucu sonuç için belirleyicidir).

export type BulkType = "PERCENT" | "FIXED";

export interface BulkRule {
  minQty: number;
  type: BulkType;
  value: number;
}

interface BulkFields {
  bulkMinQty?: number | null;
  bulkDiscountType?: string | null;
  bulkDiscountValue?: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Üründeki ham alanlardan geçerli bir kural çıkarır; eksik/geçersizse null. */
export function bulkRuleOf(p: BulkFields): BulkRule | null {
  const { bulkMinQty: minQty, bulkDiscountType: type, bulkDiscountValue: value } = p;
  if (!minQty || minQty < 2 || !value || value <= 0) return null;
  if (type !== "PERCENT" && type !== "FIXED") return null;
  if (type === "PERCENT" && value >= 100) return null;
  return { minQty, type, value };
}

/** Adet kuralına göre indirimli birim fiyat (kural yok veya adet yetersizse birim fiyat aynen döner). */
export function unitPriceFor(unit: number, quantity: number, rule: BulkRule | null | undefined): number {
  if (!rule || quantity < rule.minQty) return unit;
  const next = rule.type === "PERCENT" ? unit * (1 - rule.value / 100) : unit - rule.value;
  return round2(Math.max(0, next));
}

export const lineTotalFor = (unit: number, quantity: number, rule: BulkRule | null | undefined) =>
  round2(unitPriceFor(unit, quantity, rule) * quantity);

/** "2 ve üzeri alımda %10 indirim" / "2+ alımda adet başı 500 ₺ indirim" */
export function bulkLabel(rule: BulkRule): string {
  const v = rule.value.toLocaleString("tr-TR");
  return rule.type === "PERCENT" ? `${rule.minQty} ve üzeri alımda %${v} indirim` : `${rule.minQty}+ alımda adet başı ${v} ₺ indirim`;
}

/** Listede kısa rozet: "2+ Adet İndirimi" */
export const bulkShortLabel = (rule: BulkRule) => `${rule.minQty}+ Adet İndirimi`;
