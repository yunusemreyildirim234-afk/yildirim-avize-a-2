import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Giriş yapmış üyenin görünen adını günceller
export async function PATCH(req: Request) {
  const rl = rateLimit(req, "profile-name", 10, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  if (name.length < 2) return NextResponse.json({ error: "Ad en az 2 karakter olmalıdır." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Ad en fazla 60 karakter olabilir." }, { status: 400 });
  if (/[<>]/.test(name)) return NextResponse.json({ error: "Ad geçersiz karakter içeriyor." }, { status: 400 });

  const user = await prisma.user.update({ where: { id: userId }, data: { name }, select: { name: true } });
  return NextResponse.json({ success: true, name: user.name });
}
