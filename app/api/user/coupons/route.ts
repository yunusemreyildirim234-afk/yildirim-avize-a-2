import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { couponDiscountLabel } from "@/lib/coupon-label";

// Giriş yapmış üyenin KİŞİYE ÖZEL kuponları (Coupon.userEmail = hesap e-postası). Başkasının kuponu hiçbir koşulda dönmez.
// Yalnızca gösterim: uygulama/doğrulama /api/coupon ve /api/order'daki mevcut yoldan yapılır.
export async function GET(req: Request) {
  const rl = rateLimit(req, "user-coupons", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  // TEK sorgu: hesap e-postası kimlikten (u."id" = oturum) JOIN ile gelir; yalnız aktif, süresi dolmamış, limiti dolmamış kuponlar
  const rows = await prisma.$queryRaw<{ code: string; discountType: string; discountPercent: number; discountAmount: number | null; expiresAt: Date | null }[]>`
    SELECT c."code", c."discountType", c."discountPercent", c."discountAmount", c."expiresAt"
    FROM "Coupon" c JOIN "User" u ON lower(c."userEmail") = lower(u."email")
    WHERE u."id" = ${userId} AND c."active" = true AND c."usedCount" < c."maxUses"
      AND (c."expiresAt" IS NULL OR c."expiresAt" >= ${new Date()})
    ORDER BY c."createdAt" DESC LIMIT 10`;
  return NextResponse.json(
    { coupons: rows.map((c) => ({ code: c.code, label: couponDiscountLabel(c), expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null })) },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
