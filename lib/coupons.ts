import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_COUPON_CODE, type CouponRule, type PriceLine } from "@/lib/pricing";

export type CouponResult = { ok: true; rule: CouponRule; couponId: string } | { ok: false; error: string };

/** Varsayılan genel kod yoksa oluşturur (%5, herkese açık, yüksek limit). */
export async function ensureDefaultCoupon() {
  await prisma.coupon.upsert({
    where: { code: DEFAULT_COUPON_CODE },
    update: {},
    create: { code: DEFAULT_COUPON_CODE, discountPercent: 5, maxUses: 1_000_000 },
  });
}

/** Kodu doğrular: aktiflik, kullanım limiti, kişiye özel e-posta ve ürüne özel sepet şartı. */
export async function validateCoupon(opts: {
  code: string;
  email?: string | null;
  lines: PriceLine[];
}): Promise<CouponResult> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Geçersiz veya süresi dolmuş kupon kodu." };
  if (code === DEFAULT_COUPON_CODE) await ensureDefaultCoupon();

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, error: "Geçersiz veya süresi dolmuş kupon kodu." };
  if (coupon.usedCount >= coupon.maxUses) return { ok: false, error: "Bu kuponun kullanım hakkı dolmuştur." };

  if (coupon.userEmail) {
    const email = (opts.email ?? "").trim().toLowerCase();
    if (!email) return { ok: false, error: "Bu kupon kişiye özeldir. Lütfen giriş yapın veya e-posta adresinizi girin." };
    if (email !== coupon.userEmail.toLowerCase()) return { ok: false, error: "Bu kupon bu hesap için tanımlı değil." };
  }

  if (coupon.productId && !opts.lines.some((l) => l.productId === coupon.productId)) {
    return { ok: false, error: "Bu kupon yalnızca belirli bir üründe geçerlidir; ürün sepetinizde bulunmuyor." };
  }

  return {
    ok: true,
    couponId: coupon.id,
    rule: { code: coupon.code, discountPercent: coupon.discountPercent, productId: coupon.productId },
  };
}

/**
 * Kupon hakkını sipariş kaydıyla AYNI veritabanı işleminde (tx) rezerve eder.
 * Tek SQL ifadesi kontrol + artırımı atomik yapar; eşzamanlı isteklerde limit aşılamaz.
 * Kupon pasifse veya usedCount >= maxUses ise false döner.
 */
export async function reserveCoupon(tx: Prisma.TransactionClient, code: string): Promise<boolean> {
  const n = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "code" = ${code} AND "active" = true AND "usedCount" < "maxUses"`;
  return n > 0;
}

/** Ödemesi başarısız olan veya iptal edilen siparişin kupon hakkını geri verir. */
export async function releaseCoupon(code: string | null | undefined) {
  if (!code) return;
  await prisma.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "code" = ${code}`;
}
