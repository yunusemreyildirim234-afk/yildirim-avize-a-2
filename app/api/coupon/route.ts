import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { isLimited, rateLimit, recordFailure, tooMany } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/account";
import { COUPON_FAIL_LIMIT, COUPON_GENERIC_ERROR, COUPON_LIMITED_ERROR, COUPON_PRODUCT_ERROR, validateCoupon } from "@/lib/coupons";
import type { PriceLine } from "@/lib/pricing";

const COUPON_PER_USER_ERROR = "Bu kuponu daha önce kullandınız."; // lib/coupons.ts kişi başı limit mesajı

// Sepetteki kupon doğrulaması (oturum açıksa hesabın e-postası, değilse formdaki e-posta kullanılır)
export async function POST(req: Request) {
  const rl = rateLimit(req, "coupon", 10, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const failLimit = isLimited(req, COUPON_FAIL_LIMIT.name, COUPON_FAIL_LIMIT.max);
  if (failLimit.limited) return tooMany(failLimit.retryAfter, COUPON_LIMITED_ERROR);
  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (!body || typeof body !== "object") return badRequest();
  const code = typeof body.code === "string" ? body.code : "";
  const rawLines: { productId?: unknown; lineTotal?: unknown }[] = Array.isArray(body.lines) ? body.lines.slice(0, 100) : [];
  const lines: PriceLine[] = rawLines
    .filter((l): l is { productId: string; lineTotal: number } => typeof l.productId === "string" && typeof l.lineTotal === "number")
    .map((l) => ({ productId: l.productId, lineTotal: l.lineTotal }));

  const userId = await getSessionUserId();
  const sessionUser = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;
  const email = sessionUser?.email ?? (typeof body.email === "string" ? body.email : null);

  const result = await validateCoupon({ code, email, lines, userId });
  if (!result.ok) {
    recordFailure(req, COUPON_FAIL_LIMIT.name, COUPON_FAIL_LIMIT.windowMs);
    // Var/yok, pasif, kişiye özel ve limit ayrımı sızdırılmaz; yalnızca ürün uygunluğu ve kişi başı limit mesajları korunur
    const passThrough = result.error === COUPON_PRODUCT_ERROR || result.error === COUPON_PER_USER_ERROR;
    return NextResponse.json({ error: passThrough ? result.error : COUPON_GENERIC_ERROR }, { status: 400 });
  }
  return NextResponse.json({ rule: result.rule });
}
