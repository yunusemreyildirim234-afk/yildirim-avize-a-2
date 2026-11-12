import { cleanGuestEmail } from "./guest-email.ts";
import { ORDER_CODE_LENGTH } from "./order-display.ts";

/** 8 haneli "Sipariş Kodu" (UUID'nin ilk hanesi, onaylı e-postada gösterilen) mi? */
export const isShortOrderCode = (code: string) => new RegExp(`^[0-9a-f]{${ORDER_CODE_LENGTH}}$`, "i").test(code.trim());

const norm = (e: string) => cleanGuestEmail(e.trim()).toLowerCase();

/**
 * Kısa kodla takip: aday siparişler (kod öneki eşleşenler) arasından e-postası eşleşen TEK sipariş.
 * Eşleşme yoksa ya da birden fazlaysa (kod çakışması) null; çağıran ikisini de aynı "bulunamadı" ile yanıtlar.
 */
export function pickVerifiedOrder<T extends { email: string }>(candidates: readonly T[], email: string): T | null {
  const want = norm(email);
  if (!want.includes("@")) return null;
  const hits = candidates.filter((c) => norm(c.email) === want);
  return hits.length === 1 ? hits[0] : null;
}
