// Tamamlayıcı ürün ("bununla birlikte alın") indirimi: SAF hesap (veritabanı yok).
// Ana ürün sepetteyken tamamlayıcı ürünün birim fiyatı kademeden SONRA düşer (ardışık/yığılır).
// İndirim, tamamlayıcının sepet satırı başına YALNIZ COMPLEMENT_DISCOUNT_QTY (1) adedi için geçerlidir; kalan adetler normal fiyattan gider.
// Kurallar yalnızca sunucuda veritabanından okunur; istemci gövdesinden asla alınmaz.

/** Tamamlayıcı indirimi sepet satırı başına kaç adede uygulanır (sahip kararı: 1). */
export const COMPLEMENT_DISCOUNT_QTY = 1;

export type ComplementType = "PERCENT" | "FIXED";

export interface ComplementRule {
  mainProductId: string;
  type: ComplementType;
  value: number;
}

export interface ComplementPick {
  mainProductId: string;
  unitDiscount: number; // birim başına TL
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kural geçerli mi? (tür, sonlu ve > 0 değer, yüzde < 100) */
export function validComplementRule(r: { type: unknown; value: unknown; mainProductId?: unknown }): r is ComplementRule {
  if (typeof r.mainProductId !== "string" || !r.mainProductId) return false;
  if (r.type !== "PERCENT" && r.type !== "FIXED") return false;
  if (typeof r.value !== "number" || !Number.isFinite(r.value) || !(r.value > 0)) return false;
  return r.type !== "PERCENT" || r.value < 100;
}

/** Kademe sonrası birim fiyat üzerinden bir kuralın birim indirimi (2 ondalık). */
export function complementUnitDiscount(rule: ComplementRule, unitAfterTier: number): number {
  return rule.type === "PERCENT" ? round2((unitAfterTier * rule.value) / 100) : round2(rule.value);
}

/**
 * Uygulanacak tek bağ: ana ürünü sepette olan adaylar içinde birim indirimi en büyük olan
 * (eşitlikte küçük mainProductId); toplanmaz. Birim indirim ≤ 0 veya ≥ birim fiyat ise bağ yok sayılır.
 */
export function bestComplement(rules: ComplementRule[] | null | undefined, presentProductIds: ReadonlySet<string>, unitAfterTier: number): ComplementPick | null {
  let best: ComplementPick | null = null;
  for (const r of rules ?? []) {
    if (!validComplementRule(r) || !presentProductIds.has(r.mainProductId)) continue;
    const d = complementUnitDiscount(r, unitAfterTier);
    if (!(d > 0) || d >= unitAfterTier) continue;
    if (!best || d > best.unitDiscount || (d === best.unitDiscount && r.mainProductId < best.mainProductId)) best = { mainProductId: r.mainProductId, unitDiscount: d };
  }
  return best;
}

/** Veritabanı satırlarını tamamlayıcı ürün kimliğine göre kural listesine çevirir (geçersiz satırlar atılır). */
export function groupComplementRules(rows: { mainProductId: string; complementProductId: string; discountType: string; discountValue: number }[]): Map<string, ComplementRule[]> {
  const map = new Map<string, ComplementRule[]>();
  for (const row of rows) {
    const rule = { mainProductId: row.mainProductId, type: row.discountType, value: row.discountValue };
    if (!validComplementRule(rule)) continue;
    map.set(row.complementProductId, [...(map.get(row.complementProductId) ?? []), rule]);
  }
  return map;
}
