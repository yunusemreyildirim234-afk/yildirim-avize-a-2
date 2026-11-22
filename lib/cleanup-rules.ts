// Günlük veri temizliği (saf; veritabanı bağımlılığı enjekte edilir, tests/gunluk-temizlik.test.mjs sahte depoyla sınar).
import { RETENTION_MS } from "./activity.ts";

const DAY = 86_400_000;

/** Süresi bu kadar önce dolmuş doğrulama kodları silinir (kod 10 dk geçerlidir; 1 gün tampon). */
export const CODE_GRACE_MS = 1 * DAY;
/** Okunmuş bildirimler bu süreden sonra silinir. */
export const NOTIFICATION_KEEP_MS = 90 * DAY;

export function cleanupWhere(now: number) {
  return {
    codes: { expiresAt: { lt: new Date(now - CODE_GRACE_MS) } },
    notifications: { read: true, createdAt: { lt: new Date(now - NOTIFICATION_KEEP_MS) } },
    events: { createdAt: { lt: new Date(now - RETENTION_MS) } },
  };
}

export interface CleanupDb {
  verificationCode: { deleteMany(args: { where: ReturnType<typeof cleanupWhere>["codes"] }): Promise<{ count: number }> };
  notification: { deleteMany(args: { where: ReturnType<typeof cleanupWhere>["notifications"] }): Promise<{ count: number }> };
  clientEvent: { deleteMany(args: { where: ReturnType<typeof cleanupWhere>["events"] }): Promise<{ count: number }> };
}

/** Üç temizliği ayrı ayrı çalıştırır; biri hata verirse diğeri yine çalışır (hata sayıya değil `errors` listesine yazılır). */
export async function runDailyCleanup(db: CleanupDb, now = Date.now()): Promise<{ codes: number; notifications: number; events: number; errors: string[] }> {
  const where = cleanupWhere(now);
  const out = { codes: 0, notifications: 0, events: 0, errors: [] as string[] };
  try {
    out.codes = (await db.verificationCode.deleteMany({ where: where.codes })).count;
  } catch (e) {
    out.errors.push(`codes: ${(e as Error).message}`);
  }
  try {
    out.notifications = (await db.notification.deleteMany({ where: where.notifications })).count;
  } catch (e) {
    out.errors.push(`notifications: ${(e as Error).message}`);
  }
  // Müşteri hareket kayıtları (ClientEvent): saklama süresi lib/activity.ts RETENTION_MS (3 gün); panel açılışında değil, günlük cron'da silinir
  try {
    out.events = (await db.clientEvent.deleteMany({ where: where.events })).count;
  } catch (e) {
    out.errors.push(`events: ${(e as Error).message}`);
  }
  return out;
}
