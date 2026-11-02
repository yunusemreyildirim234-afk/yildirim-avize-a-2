import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { sendVerificationCodeEmail } from "@/lib/email";
import { EMAIL_RE } from "@/lib/validation";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { clientIp, createCode, rateLimitRemaining, type CodeType } from "@/lib/verification";

const GUEST_PASSWORD = "guest_checkout";
// Oturum gerektirmeyenler; TWO_FACTOR_LOGIN kodunu yalnızca şifre doğrulanınca /api/auth gönderir
const PUBLIC_TYPES: CodeType[] = ["REGISTER", "RESET_PASSWORD"];
const SESSION_TYPES: CodeType[] = ["CHANGE_PASSWORD", "TWO_FACTOR_ENABLE"];

export async function POST(req: Request) {
  // IP bazlı: 10 dakikada en fazla 5 kod gönderimi (e-posta kotası koruması)
  const rl = rateLimit(req, "send-code", 5, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter, "Kısa sürede çok fazla kod istediniz. Lütfen birkaç dakika sonra tekrar deneyin.");
  const body = await req.json().catch(() => ({}));
  const type = body.type as CodeType;
  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (SESSION_TYPES.includes(type)) {
    const uid = await getSessionUserId();
    const user = uid ? await prisma.user.findUnique({ where: { id: uid }, select: { email: true } }) : null;
    if (!user) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });
    email = user.email.toLowerCase();
  } else if (!PUBLIC_TYPES.includes(type)) {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });

  const ip = clientIp(req);
  const wait = await rateLimitRemaining(email, ip);
  if (wait > 0) {
    return NextResponse.json({ error: "Lütfen yeni kod istemeden önce 60 saniye bekleyin.", retryAfter: wait }, { status: 429 });
  }

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { password: true } });
  if (type === "REGISTER" && existing && existing.password !== GUEST_PASSWORD) {
    return NextResponse.json({ error: "Bu e-posta adresiyle zaten bir hesap var. Lütfen giriş yapın." }, { status: 400 });
  }

  // Şifre sıfırlamada hesap yoksa da aynı yanıt döner (e-posta taramasını önler)
  if (type === "RESET_PASSWORD" && !existing) {
    await prisma.verificationCode.create({ data: { email, code: "000000", type, ip, used: true, expiresAt: new Date() } });
    return NextResponse.json({ success: true });
  }

  const code = await createCode(email, type, ip);
  const sent = await sendVerificationCodeEmail({ to: email, code, type });
  if (!sent) return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 502 });
  return NextResponse.json({ success: true });
}
