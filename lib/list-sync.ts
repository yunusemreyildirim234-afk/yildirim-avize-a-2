/** Sepet/favori eşitlemesinde gereksiz yazmayı önleyen saf karşılaştırmalar (istemci imzası + sunucu kayıt denetimi). */

/** Liste imzası: eleman sırasından bağımsız, içerik eşitse aynı metin. */
export function listSignature(items: unknown[]): string {
  return JSON.stringify(items.map((i) => JSON.stringify(i)).sort());
}

/** Aynı variationId → adet eşlemesi mi? (sıra önemsiz) */
export function sameCartRows(a: { variationId: string; quantity: number }[], b: { variationId: string; quantity: number }[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((r) => [r.variationId, r.quantity]));
  return b.every((r) => m.get(r.variationId) === r.quantity);
}

/** Aynı kimlik kümesi mi? (sıra ve tekrar önemsiz) */
export function sameIdSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}
