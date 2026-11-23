// Tamamlayıcı ürün ("bununla birlikte alın") indirimi: SAF hesap (veritabanı yok).
// Ana ürün sepetteyken tamamlayıcı ürünün birim fiyatı kademeden SONRA düşer (ardışık/yığılır).
// Her ANA ürün adedi, tamamlayıcıdan COMPLEMENT_DISCOUNT_QTY (1) adedi KENDİ bağının birim indirimiyle indirimli yapar (allocateComplement);
// haklar büyük indirimden küçüğe kullanılır, toplanmaz; tamamlayıcı adedini aşamaz, kalan adetler normal fiyattan gider.
// Kurallar yalnızca sunucuda veritabanından okunur; istemci gövdesinden asla alınmaz.

/** Sepetteki her ana ürün adedi, tamamlayıcıdan kaç adedi indirimli yapar (sahip kararı: 1). */
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

/** Bir ana ürüne ait kullanılan indirim hakları: qty adet, birim başına unitDiscount, total = unitDiscount × qty. */
export interface ComplementGroup {
  mainProductId: string;
  unitDiscount: number;
  qty: number;
  total: number;
}

/**
 * Ana ürün adetlerine göre hak dağıtımı. Her ana ürün adedi, kendi bağının birim indirimiyle 1 adet hak doğurur
 * (indirim ≤ 0 veya ≥ birim fiyat ise o bağın hakkı yok). Haklar birim indirimi büyükten küçüğe (eşitlikte küçük mainProductId)
 * satır adedine kadar kullanılır; farklı indirimler toplanmaz. `remaining` aynı tamamlayıcının diğer satırlarıyla paylaşılan
 * kalan hak sayacıdır (ana ürün → kalan hak); verilmezse yalnız bu çağrı için kurulur. Ana ürün adetleri yalnız sunucu verisinden gelir.
 */
export function allocateComplement(
  rules: ComplementRule[] | null | undefined,
  mainQty: ReadonlyMap<string, number>,
  unitAfterTier: number,
  quantity: number,
  remaining: Map<string, number> = new Map(),
  selfProductId?: string
): ComplementGroup[] {
  const best = new Map<string, number>(); // mainProductId → en büyük geçerli birim indirim
  for (const r of rules ?? []) {
    if (!validComplementRule(r) || r.mainProductId === selfProductId || (mainQty.get(r.mainProductId) ?? 0) < 1) continue;
    const d = complementUnitDiscount(r, unitAfterTier);
    if (!(d > 0) || d >= unitAfterTier) continue;
    if (d > (best.get(r.mainProductId) ?? 0)) best.set(r.mainProductId, d);
  }
  const order = [...best].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const groups: ComplementGroup[] = [];
  let left = quantity;
  for (const [mainProductId, unitDiscount] of order) {
    if (left <= 0) break;
    const avail = remaining.get(mainProductId) ?? Math.floor(mainQty.get(mainProductId) ?? 0) * COMPLEMENT_DISCOUNT_QTY;
    const use = Math.min(avail, left);
    remaining.set(mainProductId, avail - use);
    if (use <= 0) continue;
    groups.push({ mainProductId, unitDiscount, qty: use, total: round2(unitDiscount * use) });
    left -= use;
  }
  return groups;
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
