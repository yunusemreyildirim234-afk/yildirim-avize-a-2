// Sipariş durumu değişikliği ve Geri Al için saf karar yardımcıları (veritabanı çağrıları parametredir; test edilebilir).

/** Kupon hakkı zaten iade edilmiş durumlar (tekrar iade edilmez). */
export const COUPON_FREE_STATES = ["PAYMENT_FAILED", "CANCELLED", "RETURNED"];

export interface StatusChangePlan {
  restoreStock: boolean; // ayrılmış/düşülmüş stok iade edilir
  releaseCoupon: boolean; // kupon hakkı iade edilir
}

/**
 * Durum geçişinde ne iade edilir? Stok için TEK doğruluk kaynağı Order.stockDeducted bayrağıdır (kartlı sipariş oluşturulurken, havale/ödeme sonrası düşülür).
 * - İptal/iade veya PAYMENT_FAILED'a geçişte bayrak true ise stok iade edilir (kartlı AWAITING_PAYMENT rezervasyonu dahil).
 * - İptal/iade geçişinde kupon, daha önce iade edilmediyse (PAYMENT_FAILED/CANCELLED/RETURNED değilse) iade edilir.
 */
export function planStatusChange(before: string, next: string, stockDeducted: boolean): StatusChangePlan {
  const closing = next === "CANCELLED" || next === "RETURNED";
  return {
    restoreStock: (closing || next === "PAYMENT_FAILED") && stockDeducted,
    releaseCoupon: closing && !COUPON_FREE_STATES.includes(before),
  };
}

export const COUPON_UNDO_WARNING = (code: string) =>
  `Sipariş eski durumuna döndürüldü ancak "${code}" kuponunun hakkı yeniden ayrılamadı (kupon pasif, süresi dolmuş veya kullanım limiti bu arada doldu). Kupon sayacını Kuponlar bölümünden kontrol edin.`;

/**
 * Geri Al sırasında kupon hakkını yeniden ayırır. `reserve` atomik koşullu UPDATE'tir (usedCount < maxUses).
 * Limit dolmuşsa durum geri alınmış kalır, uyarı metni döner. Yalnızca durum geri alma (koşullu güncelleme) kazanıldıktan SONRA çağrılmalıdır; böylece bir kez sayılır.
 */
export async function reserveCouponForUndo(code: string | null | undefined, reserve: (code: string) => Promise<boolean>): Promise<{ reserved: boolean; warning?: string }> {
  if (!code) return { reserved: false };
  return (await reserve(code)) ? { reserved: true } : { reserved: false, warning: COUPON_UNDO_WARNING(code) };
}
