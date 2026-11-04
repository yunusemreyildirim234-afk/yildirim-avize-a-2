import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isExpired } from "@/lib/coupon-expiry";
import { COUPON_GENERIC_ERROR } from "@/lib/coupon-code";
import { DEFAULT_COUPON_CODE, type CouponRule, type PriceLine } from "@/lib/pricing";

export { COUPON_GENERIC_ERROR };
export const COUPON_PRODUCT_ERROR = "Bu kupon yalnızca belirli bir üründe geçerlidir; ürün sepetinizde bulunmuyor.";
/** Kupon denemesi sınırı: IP başına 10 dakikada en fazla 10 BAŞARISIZ doğrulama */
export const COUPON_FAIL_LIMIT = { name: "coupon-fail", max: 10, windowMs: 10 * 60_000 };
export const COUPON_LIMITED_ERROR = "Çok fazla deneme, lütfen sonra tekrar deneyin";

export type CouponResult = { ok: true; rule: CouponRule; couponId: string } | { ok: false; error: string };

/** Varsayılan genel kod yoksa oluşturur (%5, herkese açık, yüksek limit). Vitrin kuponu yeniden adlandırıldıysa (bağ kayıtlıysa) eski kodu yeniden OLUŞTURMAZ. */
export async function ensureDefaultCoupon() {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { showcaseCouponId: true } }).catch(() => null);
  if (cfg?.showcaseCouponId) return;
  await prisma.coupon.upsert({
    where: { code: DEFAULT_COUPON_CODE },
    update: {},
    create: { code: DEFAULT_COUPON_CODE, discountPercent: 5, maxUses: 1_000_000 },
  });
}

/** Kişi başı limit sayımı: aynı e-posta (veya üye) için iptal edilmemiş siparişlerde bu kupon kaç kez kullanıldı. İstemci prisma veya transaction (kilit altında) olabilir. */
export async function countUserCouponUses(db: Pick<Prisma.TransactionClient, "order">, code: string, email: string, userId?: string | null): Promise<number> {
  const [local, domain] = email.split("@");
  return db.order.count({
    where: {
      couponCode: code,
      status: { notIn: ["CANCELLED", "RETURNED", "PAYMENT_FAILED"] },
      user: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          // Kayıtlı hesabı olan e-postanın misafir siparişleri "+misafir" etiketli adresle açılır
          ...(local && domain ? [{ email: { startsWith: `${local}+misafir`, endsWith: `@${domain}`, mode: "insensitive" as const } }] : []),
        ],
      },
    },
  });
}

/** Kodu doğrular: aktiflik, kullanım limiti, kişiye özel e-posta ve ürüne özel sepet şartı. */
export async function validateCoupon(opts: {
  code: string;
  email?: string | null;
  lines: PriceLine[];
  userId?: string | null; // giriş yapmış üye (kişi başı limit için)
}): Promise<CouponResult> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Geçersiz veya süresi dolmuş kupon kodu." };
  if (code === DEFAULT_COUPON_CODE) await ensureDefaultCoupon();

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "Geçersiz veya süresi dolmuş kupon kodu." };
  // Süresi dolmuş kupon: ayrıntı verilmez (tek genel hata). Yalnızca yeni doğrulamalarda kontrol edilir.
  if (isExpired(coupon.expiresAt)) return { ok: false, error: COUPON_GENERIC_ERROR };
  if (coupon.usedCount >= coupon.maxUses) return { ok: false, error: "Bu kuponun kullanım hakkı dolmuştur." };

  if (coupon.userEmail) {
    const email = (opts.email ?? "").trim().toLowerCase();
    if (!email) return { ok: false, error: "Bu kupon kişiye özeldir. Lütfen giriş yapın veya e-posta adresinizi girin." };
    if (email !== coupon.userEmail.toLowerCase()) return { ok: false, error: "Bu kupon bu hesap için tanımlı değil." };
  }

  if (coupon.productId && !opts.lines.some((l) => l.productId === coupon.productId)) {
    return { ok: false, error: COUPON_PRODUCT_ERROR };
  }

  // Kişi başı limit: aynı e-posta (veya üye) için iptal edilmemiş siparişlerde bu kupon kullanıldıysa reddedilir
  if (coupon.perUserLimit) {
    const email = (opts.email ?? "").trim().toLowerCase();
    if (!email && !opts.userId) return { ok: false, error: "Bu kupon için lütfen giriş yapın veya e-posta adresinizi girin." };
    const used = await countUserCouponUses(prisma, coupon.code, email, opts.userId);
    if (used >= coupon.perUserLimit) return { ok: false, error: "Bu kuponu daha önce kullandınız." };
  }

  return {
    ok: true,
    couponId: coupon.id,
    rule: {
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      productId: coupon.productId,
      discountType: coupon.discountType === "FIXED" ? "FIXED" : "PERCENT",
      discountAmount: coupon.discountAmount,
      minCartTotal: coupon.minCartTotal,
    },
  };
}

/**
 * Kupon hakkını sipariş kaydıyla AYNI veritabanı işleminde (tx) rezerve eder.
 * Tek SQL ifadesi kontrol + artırımı atomik yapar; eşzamanlı isteklerde limit aşılamaz.
 * Kupon pasifse, süresi bitmişse (expiresAt; bitiş anı Europe/Istanbul günün 23:59:59'u olarak saklanır) veya usedCount >= maxUses ise false döner.
 */
export async function reserveCoupon(tx: Prisma.TransactionClient, code: string): Promise<boolean> {
  const n = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "code" = ${code} AND "active" = true AND "usedCount" < "maxUses" AND ("expiresAt" IS NULL OR "expiresAt" >= ${new Date()})`;
  return n > 0;
}

export type CouponReserveResult = "OK" | "LIMIT" | "USER_LIMIT";

/**
 * Sipariş transaction'ında kuponu KİLİTLER (SELECT ... FOR UPDATE), kişi başı limiti kilit altında sayar, sonra atomik rezerve eder.
 * Aynı kuponu eşzamanlı kullanan istekler sırayla işlenir: ikinci istek birincinin siparişini görür.
 */
export async function reserveCouponLocked(tx: Prisma.TransactionClient, code: string, who: { email: string; userId?: string | null }): Promise<CouponReserveResult> {
  const rows = await tx.$queryRaw<{ perUserLimit: number | null }[]>`SELECT "perUserLimit" FROM "Coupon" WHERE "code" = ${code} FOR UPDATE`;
  if (rows.length === 0) return "LIMIT";
  const limit = rows[0].perUserLimit;
  if (limit && (await countUserCouponUses(tx, code, who.email, who.userId)) >= limit) return "USER_LIMIT";
  return (await reserveCoupon(tx, code)) ? "OK" : "LIMIT";
}

/** Ödemesi başarısız olan veya iptal edilen siparişin kupon hakkını geri verir. */
export async function releaseCoupon(code: string | null | undefined) {
  if (!code) return;
  await prisma.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "code" = ${code}`;
}
