import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { hasActiveConsent, recordConsent, unsubscribe } from "@/lib/marketing";
import { rateLimit, requestIp, tooMany } from "@/lib/rate-limit";

// Giriş yapmış üyenin kendi e-posta izni (MarketingConsent, üyenin e-postasıyla eşleşir). Varsayılan hiçbir zaman açılmaz:
// yalnızca üyenin kendi açık isteğiyle (enabled: true) kaydedilir.

async function sessionEmail() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? null;
}

export async function GET() {
  const email = await sessionEmail();
  // Oturum yok: 401 yerine 200 (tarayıcı konsoluna hata düşmesin)
  if (!email) return NextResponse.json({ anon: true });
  return NextResponse.json({ enabled: await hasActiveConsent(email) });
}

export async function PATCH(req: Request) {
  const rl = rateLimit(req, "user-marketing", 20, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const source = body.source === "favoriler" ? "favoriler" : "hesabim";
  const ok = body.enabled
    ? await recordConsent({ email, ip: requestIp(req), userAgent: req.headers.get("user-agent"), source })
    : await unsubscribe(email);
  if (!ok) return NextResponse.json({ error: "İzin tercihiniz şu anda kaydedilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 503 });
  return NextResponse.json({ success: true, enabled: body.enabled });
}
