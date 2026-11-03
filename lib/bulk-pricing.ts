// Kademeli adet indirimi: istemci ve sunucuda aynı hesabı kullanır (sunucu sonuç için belirleyicidir).
// Alınan adede uyan en yüksek minQty kademesi uygulanır.

export type BulkType = "PERCENT" | "FIXED";

export type BulkRule = {
  minQty: number;
  type: BulkType;
  value: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function validRule(r: unknown): BulkRule | null {
  if (!r || typeof r !== "object") return null;
  const { minQty, type, value } = r as Record<string, unknown>;
  if (typeof minQty !== "number" || !Number.isInteger(minQty) || minQty < 2) return null;
  if (type !== "PERCENT" && type !== "FIXED") return null;
  if (typeof value !== "number" || !(value > 0) || (type === "PERCENT" && value >= 100)) return null;
  return { minQty, type, value };
}

/** Ürünün (veya eski tek kuralın / sepetteki kayıtlı değerin) geçerli kademelerini minQty'ye göre sıralı döndürür. */
export function bulkTiersOf(source: unknown): BulkRule[] {
  const raw = source && typeof source === "object" && !Array.isArray(source) && "bulkTiers" in source ? (source as { bulkTiers: unknown }).bulkTiers : source;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const byQty = new Map<number, BulkRule>();
  for (const r of list) {
    const v = validRule(r);
    if (v) byQty.set(v.minQty, v);
  }
  return [...byQty.values()].sort((a, b) => a.minQty - b.minQty);
}

/** Adede uyan kademe (yoksa null). */
export function activeTier(tiers: BulkRule[] | null | undefined, quantity: number): BulkRule | null {
  let hit: BulkRule | null = null;
  for (const t of tiers ?? []) if (quantity >= t.minQty && (!hit || t.minQty > hit.minQty)) hit = t;
  return hit;
}

/** İndirimli birim fiyat (kademe yok veya adet yetersizse birim fiyat aynen döner). */
export function unitPriceFor(unit: number, quantity: number, tiers: BulkRule[] | null | undefined): number {
  const t = activeTier(tiers, quantity);
  if (!t) return unit;
  const next = t.type === "PERCENT" ? unit * (1 - t.value / 100) : unit - t.value;
  return round2(Math.max(0, next));
}

/** "2 ve üzeri alımda %10 indirim" / "2+ alımda adet başı 500 ₺ indirim" */
export function bulkLabel(rule: BulkRule): string {
  const v = rule.value.toLocaleString("tr-TR", rule.type === "FIXED" ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined);
  return rule.type === "PERCENT" ? `${rule.minQty} ve üzeri alımda %${v} indirim` : `${rule.minQty}+ alımda adet başı ${v} ₺ indirim`;
}

/** Kısa değer: "%5" / "100 ₺" */
export const tierValueLabel = (r: BulkRule) => (r.type === "PERCENT" ? `%${r.value.toLocaleString("tr-TR")}` : `${r.value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`);

/** Rozet: "2+ Adet: %5" */
export const tierBadgeLabel = (r: BulkRule) => `${r.minQty}+ Adet: ${tierValueLabel(r)}`;

/** Kademe ekler; aynı minQty varsa üstüne yazar. */
export function upsertTier(tiers: BulkRule[], rule: BulkRule): BulkRule[] {
  return bulkTiersOf([...tiers.filter((t) => t.minQty !== rule.minQty), rule]);
}
