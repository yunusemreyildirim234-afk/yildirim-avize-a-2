// Yönetici kupon listesi: sayfada yalnız aktif kuponlar + en yeni 100; "Tümünü göster" ayrı uçtan tümünü alır.
// Veritabanı yok: `db` yapısal arayüzdür (tests/admin-uye-kupon-tembel.test.mjs sahte depoyla sınar).
export const COUPON_RECENT_LIMIT = 100;
export const COUPON_INCLUDE = { product: { select: { title: true, modelCode: true } } } as const;

export interface CouponRecord {
  id: string;
  code: string;
  discountPercent: number;
  discountType: string;
  discountAmount: number | null;
  minCartTotal: number | null;
  expiresAt: Date | null;
  perUserLimit: number | null;
  maxUses: number;
  usedCount: number;
  userEmail: string | null;
  product: { title: string; modelCode: string | null } | null;
  active: boolean;
  createdAt: Date;
}

export interface CouponListDb {
  coupon: {
    findMany(args: { where?: { active: true }; include: typeof COUPON_INCLUDE; orderBy: { createdAt: "desc" }; take?: number }): Promise<CouponRecord[]>;
    count(): Promise<number>;
  };
}

export function toCouponRow(c: CouponRecord) {
  return {
    id: c.id,
    code: c.code,
    discountPercent: c.discountPercent,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    discountType: c.discountType,
    discountAmount: c.discountAmount,
    minCartTotal: c.minCartTotal,
    perUserLimit: c.perUserLimit,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    userEmail: c.userEmail,
    productTitle: c.product?.title ?? null,
    productModelCode: c.product?.modelCode ?? null,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
  };
}

const orderBy = { createdAt: "desc" } as const;

/** Sayfa açılışı: tüm aktif kuponlar + en yeni 100 (birleşik, yinelenmez, yeniden eskiye). `total` TÜM kayıtların sayısıdır (rozet değişmez). */
export async function listCouponsForPage(db: CouponListDb): Promise<{ coupons: CouponRecord[]; total: number }> {
  const [active, recent] = await Promise.all([
    db.coupon.findMany({ where: { active: true }, include: COUPON_INCLUDE, orderBy }),
    db.coupon.findMany({ include: COUPON_INCLUDE, orderBy, take: COUPON_RECENT_LIMIT }),
  ]);
  const byId = new Map<string, CouponRecord>();
  for (const c of [...recent, ...active]) byId.set(c.id, c);
  const coupons = [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  // 100'den az kayıt dönmüşse tümü zaten elimizde: ek sayım sorgusu gerekmez
  const total = recent.length < COUPON_RECENT_LIMIT ? recent.length : await db.coupon.count();
  return { coupons, total };
}

export async function listAllCoupons(db: CouponListDb): Promise<CouponRecord[]> {
  return db.coupon.findMany({ include: COUPON_INCLUDE, orderBy });
}
