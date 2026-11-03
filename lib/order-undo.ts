// Sipariş durumu değişikliği ve Geri Al için saf karar yardımcıları (veritabanı çağrıları parametredir; test edilebilir).

/** Stoğu düşülmemiş (veya zaten iade edilmiş) durumlar. */
export const NO_STOCK_STATES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"];

export interface StatusChangePlan {
  restoreStock: boolean; // düşülmüş stok iade edilir
  releaseCoupon: boolean; // kupon hakkı iade edilir
}

/**
 * İptal/iade geçişinde ne iade edilir?
 * - Stoğu düşülmüş sipariş (PENDING, SHIPPED...): stok + kupon.
 * - Ödeme bekleyen sipariş: yalnızca kupon (hak sipariş anında ayrılmıştı, stok düşülmemişti).
 * - PAYMENT_FAILED / CANCELLED / RETURNED: hiçbiri (kupon zaten iade edilmişti).
 */
export function planStatusChange(before: string, next: string): StatusChangePlan {
  const closing = next === "CANCELLED" || next === "RETURNED";
  const restoreStock = closing && !NO_STOCK_STATES.includes(before);
  return { restoreStock, releaseCoupon: restoreStock || (closing && before === "AWAITING_PAYMENT") };
}

export const COUPON_UNDO_WARNING = (code: string) =>
  `Sipariş eski durumuna döndürüldü ancak "${code}" kuponunun hakkı yeniden ayrılamadı (kupon pasif veya kullanım limiti bu arada doldu). Kupon sayacını Kuponlar bölümünden kontrol edin.`;

/**
 * Geri Al sırasında kupon hakkını yeniden ayırır. `reserve` atomik koşullu UPDATE'tir (usedCount < maxUses).
 * Limit dolmuşsa durum geri alınmış kalır, uyarı metni döner. Yalnızca durum geri alma (koşullu güncelleme) kazanıldıktan SONRA çağrılmalıdır; böylece bir kez sayılır.
 */
export async function reserveCouponForUndo(code: string | null | undefined, reserve: (code: string) => Promise<boolean>): Promise<{ reserved: boolean; warning?: string }> {
  if (!code) return { reserved: false };
  return (await reserve(code)) ? { reserved: true } : { reserved: false, warning: COUPON_UNDO_WARNING(code) };
}
