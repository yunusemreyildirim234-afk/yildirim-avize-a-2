// Siparişe bağlantıyla erişim kuralları. Saf yardımcı: veritabanı çağrısı yok (test edilebilir).

/** Misafir siparişinde oturumsuz erişim süresi: dekont güncelleme ve sipariş sayfasının tam görünümü aynı sabiti kullanır. */
export const GUEST_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const isGuestOrderWindowOpen = (createdAt: Date, now: number = Date.now()) => now - createdAt.getTime() < GUEST_ORDER_WINDOW_MS;

/** Tam görünüm: oturumlu sipariş sahibi veya süresi dolmamış misafir siparişi. */
export function canViewOrderDetails(o: { userId: string; isGuest: boolean; createdAt: Date }, sessionUserId: string | null, now: number = Date.now()): boolean {
  if (sessionUserId && sessionUserId === o.userId) return true;
  return o.isGuest && isGuestOrderWindowOpen(o.createdAt, now);
}
