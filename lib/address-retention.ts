// Adres defteri saklama süresi (aydınlatma metni: 3 yıl). Saf kural + enjekte edilen depo; tests/adres-saklama.test.mjs sahte depoyla sınar.
// Yalnız kayıtlı adres defteri (Address) silinir; siparişler ve sipariş adresleri (Order alanları) ASLA etkilenmez.
const DAY = 86_400_000;
export const ADDRESS_RETENTION_MS = 3 * 365 * DAY;
const BATCH = 500;

export interface RetentionUser {
  lastLoginAt: Date | null;
  createdAt: Date;
  lastOrderAt: Date | null;
}

/** Hesabın son etkinliği: son giriş (boşsa hesap tarihi), son sipariş ve hesap tarihinin EN YENİSİ. */
export function lastActivityMs(u: RetentionUser): number {
  return Math.max(u.lastLoginAt?.getTime() ?? 0, u.createdAt.getTime(), u.lastOrderAt?.getTime() ?? 0);
}

/** Son etkinlik 3 yıldan eskiyse adres defteri silinmelidir. */
export function isAddressBookExpired(u: RetentionUser, now: number): boolean {
  return lastActivityMs(u) < now - ADDRESS_RETENTION_MS;
}

export interface RetentionDb {
  user: { findMany(args: { where: { addresses: { some: Record<string, never> }; createdAt: { lt: Date }; OR: ({ lastLoginAt: null } | { lastLoginAt: { lt: Date } })[] }; select: { id: true; lastLoginAt: true; createdAt: true }; take: number }): Promise<{ id: string; lastLoginAt: Date | null; createdAt: Date }[]> };
  order: { groupBy(args: { by: ["userId"]; where: { userId: { in: string[] } }; _max: { createdAt: true } }): Promise<{ userId: string; _max: { createdAt: Date | null } }[]> };
  address: { deleteMany(args: { where: { userId: { in: string[] } } }): Promise<{ count: number }> };
}

/** Süresi dolan hesapların kayıtlı adreslerini siler; silinen ADRES sayısını döner (kişisel veri dönmez/yazılmaz). */
export async function purgeExpiredAddressBooks(db: RetentionDb, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - ADDRESS_RETENTION_MS);
  // Ön süzgeç (ucuz): adresi olan, hesabı ve son girişi kesimden eski hesaplar; kesin karar sipariş tarihiyle birlikte saf kuralla verilir
  const candidates = await db.user.findMany({
    where: { addresses: { some: {} }, createdAt: { lt: cutoff }, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }] },
    select: { id: true, lastLoginAt: true, createdAt: true },
    take: BATCH,
  });
  if (candidates.length === 0) return 0;
  const ids = candidates.map((c) => c.id);
  const lastOrders = await db.order.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { createdAt: true } });
  const lastOrderOf = new Map(lastOrders.map((o) => [o.userId, o._max.createdAt]));
  const expired = candidates
    .filter((c) => isAddressBookExpired({ lastLoginAt: c.lastLoginAt, createdAt: c.createdAt, lastOrderAt: lastOrderOf.get(c.id) ?? null }, now))
    .map((c) => c.id);
  if (expired.length === 0) return 0;
  return (await db.address.deleteMany({ where: { userId: { in: expired } } })).count;
}
