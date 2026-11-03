import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { cleanDisplayName } from "@/lib/validation";

// Giriş yapmış üyenin görünen adını günceller
export async function PATCH(req: Request) {
  const rl = rateLimit(req, "profile-name", 10, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const checked = cleanDisplayName(body.name);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const name = checked.name;

  const user = await prisma.user.update({ where: { id: userId }, data: { name }, select: { name: true } });
  return NextResponse.json({ success: true, name: user.name });
}
