import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/account";
import { validateCoupon } from "@/lib/coupons";
import type { PriceLine } from "@/lib/pricing";

// Sepetteki kupon doğrulaması (oturum açıksa hesabın e-postası, değilse formdaki e-posta kullanılır)
export async function POST(req: Request) {
  const rl = rateLimit(req, "coupon", 10, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const rawLines: { productId?: unknown; lineTotal?: unknown }[] = Array.isArray(body.lines) ? body.lines.slice(0, 100) : [];
  const lines: PriceLine[] = rawLines
    .filter((l): l is { productId: string; lineTotal: number } => typeof l.productId === "string" && typeof l.lineTotal === "number")
    .map((l) => ({ productId: l.productId, lineTotal: l.lineTotal }));

  const userId = await getSessionUserId();
  const sessionUser = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;
  const email = sessionUser?.email ?? (typeof body.email === "string" ? body.email : null);

  const result = await validateCoupon({ code, email, lines });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ rule: result.rule });
}
