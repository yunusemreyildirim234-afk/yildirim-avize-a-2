/** Saf yardımcılar: stok birleştirme/karşılaştırma ve terk edilmiş kartlı ödeme eşiği (test edilebilir). */

/** lib/paytr.ts içindeki `timeout_limit` (dakika) ile aynı olmalıdır. */
export const PAYTR_TIMEOUT_MINUTES = 30;
/** Kartlı ödeme token ömründen sonra callback gecikmesine tanınan pay (dakika). */
export const ABANDON_GRACE_MINUTES = 60;
/** Bu süreyi (dakika) geçen AWAITING_PAYMENT + kartlı siparişler PAYMENT_FAILED yapılır. Tek sabit. */
export const ABANDONED_CARD_MINUTES = PAYTR_TIMEOUT_MINUTES + ABANDON_GRACE_MINUTES;

/** Aynı variationId'li satırları toplam adede birleştirir; çıktı variationId'ye göre SIRALIDIR (stok satır kilitleri hep aynı sırada alınır, deadlock olmaz). Yalnızca stok kilitleme/arama içindir; sipariş kalemleri ve fiyat bu çıktıdan üretilmez. */
export function mergeByVariation<T extends { variationId: string; quantity: number }>(lines: T[]): { variationId: string; quantity: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.variationId, (m.get(l.variationId) ?? 0) + l.quantity);
  return [...m].map(([variationId, quantity]) => ({ variationId, quantity })).sort((a, b) => (a.variationId < b.variationId ? -1 : a.variationId > b.variationId ? 1 : 0));
}

/** true = stok toplam adedi karşılamıyor. */
export const isShort = (stock: number, qty: number) => stock < qty;

/** Cron'un kapatacağı sipariş mi? Yalnızca kartlı + AWAITING_PAYMENT + eşik geçmiş. Havale (PENDING_NEW) asla. */
export function shouldCloseAbandonedCard(o: { status: string; paymentMethod: string | null; createdAt: Date }, now: number): boolean {
  return o.status === "AWAITING_PAYMENT" && o.paymentMethod === "CREDIT_CARD" && o.createdAt.getTime() < now - ABANDONED_CARD_MINUTES * 60_000;
}

/** Kartlı siparişte stok sipariş anında ayrılır. Token ömrü + 15 dk geçen AWAITING_PAYMENT rezervasyonu yeni sipariş stok yetersizliği görünce serbest bırakılır. */
export const RESERVATION_RELEASE_MINUTES = PAYTR_TIMEOUT_MINUTES + 15;

/** Rezervasyon bayatladı mı (serbest bırakılabilir)? Sınır dahil değil: tam 45. dakikada hâlâ ayrılı. */
export function isStaleReservation(createdAt: Date, now: number): boolean {
  return createdAt.getTime() < now - RESERVATION_RELEASE_MINUTES * 60_000;
}
