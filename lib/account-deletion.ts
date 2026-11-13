// Hesap silme (talep + onay) kuralları: saf mantık. Veritabanı erişimi `DeletionDb` arayüzü arkasındadır; gerçek bağlantı
// lib/account-deletion-db.ts içinde Prisma işlemine (transaction) bağlanır, testler bellek içi sahte uygulama kullanır.
// Siparişler yasal saklama için korunur: kullanıcı satırı SİLİNMEZ, anonimleştirilir. Kişisel veriler (yorum, sepet, adres, favori, mesaj,
// bildirim, doğrulama kodu, olay kaydı) silinir. Pazarlama kaydı silinmez: abonelikten çıkış olarak işaretlenir (e-posta tekrar eklenmesin).

import { cleanGuestEmail } from "./guest-email.ts";

/** Bu durumlardaki siparişler "kapalı" sayılır; bunların dışındaki (bilinmeyenler dahil) her durum açık siparişidir. */
export const CLOSED_ORDER_STATUSES = ["DELIVERED", "CANCELLED", "RETURNED", "PAYMENT_FAILED"];

export const DELETED_NAME = "Silinmiş hesap";
export const DELETED_PASSWORD = "deleted_account"; // "scrypt$" ile başlamadığı için hiçbir parola bununla eşleşmez
export const DELETED_EMAIL_DOMAIN = "silinmis.invalid"; // .invalid: e-posta hiçbir yere gitmez

export const deletedEmail = (userId: string) => `silinmis-${userId}@${DELETED_EMAIL_DOMAIN}`;
export const isDeletedEmail = (email: string) => email.toLowerCase().endsWith(`@${DELETED_EMAIL_DOMAIN}`);

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface DeletionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}
export interface DeletionRequestRow {
  id: string;
  userId: string;
  status: string;
}
export interface OrderState {
  status: string;
  cancelReturnStatus: string | null;
}

export interface DeletionDb {
  /** Kullanıcı satırı kilidi: aynı kişiye ait eşzamanlı işlemler sıraya girer. */
  lockUser(userId: string): Promise<void>;
  findUser(userId: string): Promise<DeletionUser | null>;
  /** Aynı gerçek e-postadan açılmış misafir hesapları ("ad+misafirXXXX@alan", parola "guest_checkout"). */
  findGuestSiblings(email: string): Promise<{ id: string; email: string }[]>;
  findRequest(id: string): Promise<DeletionRequestRow | null>;
  findPendingRequest(userId: string): Promise<DeletionRequestRow | null>;
  createRequest(userId: string): Promise<DeletionRequestRow>;
  /** Koşullu geçiş PENDING → to; yalnızca bir çağrı kazanır (true). */
  transitionRequest(id: string, to: Exclude<RequestStatus, "PENDING">, adminNote: string | null, now: Date): Promise<boolean>;
  listOrderStates(userIds: string[]): Promise<OrderState[]>;
  deleteByUser(kind: "review" | "cartItem" | "address" | "favorite", userIds: string[]): Promise<void>;
  deleteByEmail(kind: "verificationCode" | "clientEvent", emails: string[]): Promise<void>;
  deleteContactMessages(userIds: string[], emails: string[]): Promise<void>;
  deleteNotifications(userIds: string[], emails: string[]): Promise<void>;
  /** Kişiye özel kuponlar kapatılır ve e-posta alanı anonim adrese çekilir (kullanım geçmişi korunur). */
  deactivateCoupons(emails: string[], anonymousEmail: string): Promise<void>;
  /** Kayıt varsa abonelikten çıkış işaretlenir, ip/userAgent temizlenir; e-posta ve onay tarihi kalır. */
  unsubscribeMarketing(emails: string[], now: Date): Promise<void>;
  anonymizeUser(userId: string, data: { email: string; name: string; password: string }): Promise<void>;
}

export type Fail = { ok: false; status: number; error: string };

const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** Açık sipariş: kapalı durumlar dışındaki her durum ya da bekleyen iptal/iade talebi. */
export function isOpenOrder(o: OrderState): boolean {
  return !CLOSED_ORDER_STATUSES.includes(o.status) || o.cancelReturnStatus === "PENDING";
}

/** Müşteri talebi oluşturur. Zaten bekleyen talep varsa yenisi açılmaz (created: false). */
export async function createDeletionRequest(db: DeletionDb, userId: string): Promise<({ ok: true; created: boolean; request: DeletionRequestRow; email: string; name: string }) | Fail> {
  await db.lockUser(userId);
  const user = await db.findUser(userId);
  if (!user) return fail(401, "Oturum açmanız gerekiyor.");
  if (user.role !== "USER") return fail(403, "Yönetici hesapları bu yolla silinemez.");
  const pending = await db.findPendingRequest(userId);
  if (pending) return { ok: true, created: false, request: pending, email: user.email, name: user.name };
  const request = await db.createRequest(userId);
  return { ok: true, created: true, request, email: user.email, name: user.name };
}

/** Müşteri kendi bekleyen talebini geri çeker. */
export async function cancelDeletionRequest(db: DeletionDb, userId: string, now = new Date()): Promise<{ ok: true } | Fail> {
  const pending = await db.findPendingRequest(userId);
  if (!pending) return fail(404, "Bekleyen bir hesap silme talebiniz yok.");
  if (!(await db.transitionRequest(pending.id, "CANCELLED", null, now))) return fail(409, "Talep zaten işlenmiş.");
  return { ok: true };
}

/** Yönetici reddi: hesap ve veriler olduğu gibi kalır. */
export async function rejectDeletionRequest(db: DeletionDb, requestId: string, adminNote: string | null, now = new Date()): Promise<{ ok: true; userId: string } | Fail> {
  const req = await db.findRequest(requestId);
  if (!req) return fail(404, "Talep bulunamadı.");
  if (!(await db.transitionRequest(req.id, "REJECTED", adminNote, now))) return fail(409, "Bu talep zaten işlenmiş.");
  return { ok: true, userId: req.userId };
}

/**
 * Yönetici onayı. Tek transaction içinde çağrılmalıdır. Açık sipariş varsa (kişinin ve misafir hesaplarının) onay engellenir ve talep PENDING kalır.
 * Talep koşullu geçişle sahiplenilir; aynı talep ikinci kez çalıştırılırsa hiçbir veri değişmez (idempotent).
 * Dönen e-posta/ad, silme e-postası için ANONİMLEŞTİRMEDEN önceki değerlerdir.
 */
export async function approveDeletionRequest(db: DeletionDb, requestId: string, adminNote: string | null, now = new Date()): Promise<({ ok: true; email: string; name: string }) | Fail> {
  const req = await db.findRequest(requestId);
  if (!req) return fail(404, "Talep bulunamadı.");
  if (req.status !== "PENDING") return fail(409, "Bu talep zaten işlenmiş.");

  await db.lockUser(req.userId);
  const user = await db.findUser(req.userId);
  if (!user) return fail(404, "Hesap bulunamadı.");
  if (user.role !== "USER") return fail(403, "Yönetici hesapları bu yolla silinemez.");

  const original = { email: user.email, name: user.name }; // silme e-postası için anonimleştirmeden ÖNCE alınır
  const siblings = await db.findGuestSiblings(original.email);
  const userIds = [user.id, ...siblings.map((s) => s.id).filter((id) => id !== user.id)];
  for (const id of userIds) await db.lockUser(id);

  const orders = await db.listOrderStates(userIds);
  const open = orders.filter(isOpenOrder).length;
  if (open > 0) return fail(409, `Hesabın tamamlanmamış ${open} siparişi var (bekleyen, kargodaki veya açık iptal/iade talepli). Bunlar kapanmadan hesap silinemez.`);

  if (!(await db.transitionRequest(req.id, "APPROVED", adminNote, now))) return fail(409, "Bu talep zaten işlenmiş.");

  // Kişiye ait tüm e-posta biçimleri (küçük harf): hesap e-postası, misafir etiketli adresler ve etiketsiz gerçek adres
  const emails = [...new Set([original.email, ...siblings.map((s) => s.email), ...siblings.map((s) => cleanGuestEmail(s.email))].map((e) => e.trim().toLowerCase()))];

  await db.deleteByUser("review", userIds); // ReviewImage, Review'a bağlı cascade ile gider
  await db.deleteByUser("cartItem", userIds);
  await db.deleteByUser("address", userIds);
  await db.deleteByUser("favorite", userIds);
  await db.deleteContactMessages(userIds, emails);
  await db.deleteNotifications(userIds, emails);
  await db.deleteByEmail("verificationCode", emails);
  await db.deleteByEmail("clientEvent", emails);
  await db.deactivateCoupons(emails, deletedEmail(user.id));
  await db.unsubscribeMarketing(emails, now);
  for (const id of userIds) await db.anonymizeUser(id, { email: deletedEmail(id), name: DELETED_NAME, password: DELETED_PASSWORD });

  return { ok: true, ...original };
}
