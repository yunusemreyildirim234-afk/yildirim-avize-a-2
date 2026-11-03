// Müşterinin kendi önceki (ödenmemiş) kartlı siparişini serbest bırakma kararı. Saf yardımcı: veritabanı çağrısı yok (test edilebilir).
// Yalnızca istemcinin bildiği sipariş kimliği (UUID) geçerlidir; e-posta tek başına asla yetmez.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrderId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const stripGuestTag = (email: string) => email.replace(/\+misafir[a-z0-9]+@/i, "@").trim().toLowerCase();

export interface PreviousOrderRow {
  status: string;
  paymentMethod: string | null;
  userId: string;
  user: { email: string; password: string };
}

/**
 * Önceki sipariş serbest bırakılabilir mi?
 * - hâlâ AWAITING_PAYMENT ve kartlı;
 * - e-posta (normalize, "+misafir" etiketi çıkarılmış) aynı;
 * - oturum varsa sipariş aynı kullanıcıya ait; oturum yoksa yalnızca misafir kaydına ait (kayıtlı hesabın siparişi oturumsuz serbest bırakılamaz).
 */
export function canReleasePrevious(prev: PreviousOrderRow | null | undefined, ctx: { email: string; sessionUserId?: string | null }): boolean {
  if (!prev || prev.status !== "AWAITING_PAYMENT" || prev.paymentMethod !== "CREDIT_CARD") return false;
  if (stripGuestTag(prev.user.email) !== ctx.email.trim().toLowerCase()) return false;
  if (ctx.sessionUserId) return prev.userId === ctx.sessionUserId;
  return prev.user.password === "guest_checkout";
}
