// Ödeme bekleyen kartlı siparişlerin kötüye kullanım denetimi. Saf yardımcı: veritabanı çağrısı yok (test edilebilir).
// Order'da IP saklanmadığı için kimlik: e-posta ("+misafir" etiketi çıkarılmış) ve telefon (son 10 hane).

/** Aynı telefon için aynı anda en fazla bu kadar bekleyen kartlı sipariş olabilir. */
export const MAX_PENDING_PER_CONTACT = 2;
export const PENDING_LIMIT_ERROR = "Bekleyen ödemeniz var, lütfen tamamlayın veya birkaç dakika sonra tekrar deneyin.";

export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);
export const emailKey = (email: string) => email.replace(/\+misafir[a-z0-9]+@/i, "@").trim().toLowerCase();

export const BANK_PENDING_LIMIT_ERROR = "Ödemesi beklenen Havale/EFT siparişleriniz var. Yeni sipariş vermeden önce mevcut siparişinizin ödemesini tamamlayın veya bizimle iletişime geçin.";

/** Havale: aynı e-posta/telefonun bekleyen sipariş sayısı sınırdaysa true. Eski sipariş iptal edilmez (müşteri ödemiş olabilir), yalnızca yenisi reddedilir. */
export function bankPendingBlocked(rows: { phone: string | null; user: { email: string } }[], ctx: { email: string; phone: string }): boolean {
  const email = emailKey(ctx.email);
  const phone = phoneKey(ctx.phone);
  const same = rows.filter((r) => emailKey(r.user.email) === email || (phone.length >= 7 && phoneKey(r.phone) === phone));
  return same.length >= MAX_PENDING_PER_CONTACT;
}

export interface PendingRow {
  id: string;
  phone: string | null;
  userId: string;
  user: { email: string; password: string };
}

/**
 * Yeni kartlı sipariş, müşterinin hangi bekleyen siparişlerinin YERİNE geçer (swapIds) ve bekleyen sınırı dolu mu (blocked)?
 * Bir bekleyen sipariş yalnızca kanıtlı sahiplikle değiştirilir; E-POSTA TEK BAŞINA YETMEZ (başkasının e-postasını yazan biri
 * o kişinin ödeme sayfası açık siparişini kapatamaz):
 * - Oturum varsa: oturumdaki kullanıcının kendi bekleyen siparişleri (userId eşleşmesi).
 * - Oturum yoksa: yalnızca tarayıcının bildiği önceki sipariş kimliği (previousOrderId), e-posta aynı ve kayıt misafir ise
 *   (kayıtlı hesabın siparişine oturumsuz dokunulmaz).
 * Değiştirilmeyenlerden aynı telefon/e-postalı olanlar sayılır; MAX_PENDING_PER_CONTACT ve üstü ise yeni sipariş reddedilir.
 * Değiştirme, yeni sipariş kaydıyla aynı transaction'da yapılır (lib/order-swap.ts); bu fonksiyon yalnızca karar verir.
 */
export function planPendingCleanup(
  rows: PendingRow[],
  ctx: { email: string; phone: string; sessionUserId?: string | null; previousOrderId?: string | null }
): { swapIds: string[]; blocked: boolean } {
  const email = emailKey(ctx.email);
  const phone = phoneKey(ctx.phone);
  const swapIds: string[] = [];
  let remaining = 0;
  for (const r of rows) {
    const sameEmail = emailKey(r.user.email) === email;
    const samePhone = phone.length >= 7 && phoneKey(r.phone) === phone;
    const mine = ctx.sessionUserId
      ? r.userId === ctx.sessionUserId
      : Boolean(ctx.previousOrderId) && r.id === ctx.previousOrderId && sameEmail && r.user.password === "guest_checkout";
    if (mine) swapIds.push(r.id);
    else if (sameEmail || samePhone) remaining++;
  }
  return { swapIds, blocked: remaining >= MAX_PENDING_PER_CONTACT };
}
