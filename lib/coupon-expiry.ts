// Kupon bitişi: seçilen günün SONUNA kadar, Türkiye saati (UTC+03:00, yaz/kış saati yok). Sunucu saat dilimine bağlı değildir.
const TR_OFFSET_MS = 3 * 3600_000;
const DAY_MS = 24 * 3600_000;

/** "YYYY-MM-DD" → o günün 23:59:59.999 (+03:00) anı; geçersizse null. */
export function expiryFromDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T23:59:59.999+03:00`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) < "2000-01-01" ? null : d;
}

/** Bitiş anının Türkiye takvim günü ("YYYY-MM-DD"). */
export function trDateOf(expiresAt: Date | string): string {
  return new Date(new Date(expiresAt).getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Bugünün Türkiye takvim günü. */
export const trToday = (now: Date = new Date()) => trDateOf(now);

export function isExpired(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  return !!expiresAt && now.getTime() > new Date(expiresAt).getTime();
}

/** Bitişe kalan takvim günü (Türkiye günü): bugün bitiyorsa 0; dolmuşsa negatif. */
export function daysLeft(expiresAt: Date | string, now: Date = new Date()): number {
  const a = Date.parse(`${trDateOf(expiresAt)}T00:00:00Z`);
  const b = Date.parse(`${trToday(now)}T00:00:00Z`);
  return Math.round((a - b) / DAY_MS);
}
