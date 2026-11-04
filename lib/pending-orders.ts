// Ödeme bekleyen kartlı siparişlerin kötüye kullanım denetimi. Saf yardımcı: veritabanı çağrısı yok (test edilebilir).
// Order'da IP saklanmadığı için kimlik: e-posta ("+misafir" etiketi çıkarılmış) ve telefon (son 10 hane).

/** Aynı telefon için aynı anda en fazla bu kadar bekleyen kartlı sipariş olabilir. */
export const MAX_PENDING_PER_CONTACT = 2;
export const PENDING_LIMIT_ERROR = "Bekleyen ödemeniz var, lütfen tamamlayın veya birkaç dakika sonra tekrar deneyin.";

export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);
export const emailKey = (email: string) => email.replace(/\+misafir[a-z0-9]+@/i, "@").trim().toLowerCase();

export interface PendingRow {
  id: string;
  phone: string | null;
  userId: string;
  user: { email: string; password: string };
}

/**
 * - Aynı e-postalı eski bekleyen sipariş otomatik iptal edilir (vazgeçip dönen müşteri kendi stoğunu kilitlemez);
 *   oturum varsa yalnızca kendi kullanıcısının, yoksa yalnızca misafir kaydının siparişi iptal edilir (kayıtlı hesaba oturumsuz dokunulmaz).
 * - İptal edilmeyenlerden aynı telefon/e-postalı olanlar sayılır; MAX_PENDING_PER_CONTACT ve üstü ise yeni sipariş reddedilir.
 */
export function planPendingCleanup(
  rows: PendingRow[],
  ctx: { email: string; phone: string; sessionUserId?: string | null }
): { cancelIds: string[]; blocked: boolean } {
  const email = emailKey(ctx.email);
  const phone = phoneKey(ctx.phone);
  const cancelIds: string[] = [];
  let remaining = 0;
  for (const r of rows) {
    const sameEmail = emailKey(r.user.email) === email;
    const samePhone = phone.length >= 7 && phoneKey(r.phone) === phone;
    if (!sameEmail && !samePhone) continue;
    const mine = ctx.sessionUserId ? r.userId === ctx.sessionUserId : r.user.password === "guest_checkout";
    if (sameEmail && mine) cancelIds.push(r.id);
    else remaining++;
  }
  return { cancelIds, blocked: remaining >= MAX_PENDING_PER_CONTACT };
}
