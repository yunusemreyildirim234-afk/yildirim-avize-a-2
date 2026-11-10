// Yönetici stok düzenlemesinin saf çekirdeği (veritabanı çağrısı parametredir; test edilebilir).
// Sorun: panel açıkken sipariş gelirse (stok rezervasyonla düşer), eski sayıya göre yazılan MUTLAK değer rezervasyonu ezer ve stok fazla görünür.
// Çözüm: karşılaştır-ve-yaz. İstemci, formda gördüğü başlangıç stoğunu (prev) da gönderir; değer değişmediyse stok HİÇ yazılmaz,
// değiştiyse yalnızca veritabanındaki stok hâlâ prev ise yazılır. Uyuşmazlıkta yönetici güncel sayıyı görmeden hiçbir şey yazılmaz.

export const STOCK_CHANGED_ERROR = "Stok bu sırada değişti (yeni sipariş veya başka bir işlem). Hiçbir şey kaydedilmedi; sayfayı yenileyip güncel stoğu görerek tekrar deneyin.";
export const STOCK_PREV_MISSING_ERROR = "Stok kaydedilemedi: sayfa eski sürümde açık kalmış. Sayfayı yenileyip tekrar deneyin.";

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export type StockWritePlan = { kind: "INVALID" } | { kind: "SKIP" } | { kind: "CAS"; expected: number; next: number };

/** Tek varyasyon: prev = formun açıldığı andaki stok. prev yok/geçersizse INVALID (mutlak yazıma geri düşülmez). */
export function planStockWrite(next: number, prev: unknown): StockWritePlan {
  if (!isCount(next) || !isCount(prev)) return { kind: "INVALID" };
  return next === prev ? { kind: "SKIP" } : { kind: "CAS", expected: prev, next };
}

export interface StockEdit {
  id: string;
  expected: number;
  next: number;
}

/**
 * Toplu "stok = X": hedef varyasyonların her biri için plan. `expected` istemcinin listede gördüğü stoklardır (variationId → stok).
 * Listede görülmemiş (bu arada eklenmiş) varyasyon `missing` olarak döner; çağıran bunu da çakışma sayar.
 */
export function planBulkStockSet(variationIds: string[], expected: unknown, value: number): { edits: StockEdit[]; missing: string[] } {
  const map = expected && typeof expected === "object" && !Array.isArray(expected) ? (expected as Record<string, unknown>) : {};
  const edits: StockEdit[] = [];
  const missing: string[] = [];
  for (const id of variationIds) {
    const plan = planStockWrite(value, map[id]);
    if (plan.kind === "INVALID") missing.push(id);
    else if (plan.kind === "CAS") edits.push({ id, expected: plan.expected, next: plan.next });
  }
  return { edits, missing };
}

export class StockConflict extends Error {
  readonly ids: string[];
  constructor(ids: string[]) {
    super("stock-conflict");
    this.ids = ids;
  }
}

/**
 * Planı uygular. `cas(id, expected, next)` koşullu atomik UPDATE'tir (WHERE stock = expected) ve yazdıysa true döner.
 * Bir tanesi bile uyuşmazsa StockConflict fırlatır: çağıran transaction içinde olduğundan önceki yazımlar geri alınır (hepsi ya da hiçbiri).
 */
export async function applyStockEdits(edits: StockEdit[], cas: (id: string, expected: number, next: number) => Promise<boolean>): Promise<number> {
  const conflicts: string[] = [];
  for (const e of edits) if (!(await cas(e.id, e.expected, e.next))) conflicts.push(e.id);
  if (conflicts.length > 0) throw new StockConflict(conflicts);
  return edits.length;
}
