/** Saf yardımcılar: stok birleştirme/karşılaştırma ve terk edilmiş kartlı ödeme eşiği (test edilebilir). */

/** Kartlı ödeme stok tutma süresi (dakika): sipariş anından itibaren. Süre dolunca ödeme bekleyen sipariş serbest bırakılır. */
export const RESERVATION_HOLD_MINUTES = 15;
/** lib/paytr.ts `timeout_limit` (dakika): tutma süresinden 1 dk kısa; ödeme sayfası, stok serbest kalmadan önce kapanır (geç ödeme çakışması olmaz). */
export const PAYTR_TIMEOUT_MINUTES = RESERVATION_HOLD_MINUTES - 1;
/** Bu süreyi (dakika) geçen AWAITING_PAYMENT + kartlı siparişler PAYMENT_FAILED yapılır (günlük cron'un eşiği = tutma süresi). */
export const ABANDONED_CARD_MINUTES = RESERVATION_HOLD_MINUTES;

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

/** Kartlı siparişte stok sipariş anında ayrılır; tutma süresi dolan AWAITING_PAYMENT rezervasyonu stok okunurken / sipariş oluşturulurken tembel serbest bırakılır. */
export const RESERVATION_RELEASE_MINUTES = RESERVATION_HOLD_MINUTES;

/** Ödeme bekleyen siparişin stok tutma süresinin bitiş zamanı. */
export function reservationExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RESERVATION_HOLD_MINUTES * 60_000);
}

/** Rezervasyon bayatladı mı (serbest bırakılabilir)? Sınır dahil değil: tam 15. dakikada hâlâ ayrılı. */
export function isStaleReservation(createdAt: Date, now: number): boolean {
  return createdAt.getTime() < now - RESERVATION_RELEASE_MINUTES * 60_000;
}
