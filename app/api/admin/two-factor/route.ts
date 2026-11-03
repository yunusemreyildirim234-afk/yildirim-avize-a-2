import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { sendVerificationCodeEmail } from "@/lib/email";
import { clientIp, consumeCode, createCode, rateLimitRemaining } from "@/lib/verification";
import { nextTwoFactorAction } from "@/lib/admin-2fa";

// Yönetici hesabı için 2FA açma/kapatma (müşterilerdeki TWO_FACTOR_ENABLE / TWO_FACTOR_DISABLE e-posta kodlarıyla aynı akış).
// Yönetici çerezi hesabı tanımlamadığı için hangi hesap olduğu e-posta + şifre ile kanıtlanır. Kapatma da e-posta kodu ister.
// Adım "send": kod gönderir; adım "verify": kodu doğrular ve durumu değiştirir. Açma/kapatma yönü hesabın MEVCUT durumundan türetilir.
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-2fa-manage", 10, 15 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "E-posta ve şifre zorunludur." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, role: "ADMIN" },
    select: { id: true, email: true, role: true, password: true, twoFactorEnabled: true },
  });
  const action = nextTwoFactorAction(user, !!user && verifyPassword(password, user.password));
  if (action === "DENY" || !user) return NextResponse.json({ error: "E-posta veya şifre hatalı ya da bu hesap yönetici değil." }, { status: 401 });
  const type = action === "ENABLE" ? "TWO_FACTOR_ENABLE" : "TWO_FACTOR_DISABLE";
  const to = user.email.toLowerCase();

  if (body.step === "verify") {
    const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "6 haneli kodu giriniz." }, { status: 400 });
    if (!(await consumeCode(to, type, code))) return NextResponse.json({ error: "Doğrulama kodu hatalı veya süresi dolmuş." }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: action === "ENABLE" } });
    return NextResponse.json({ success: true, enabled: action === "ENABLE" });
  }

  const ip = clientIp(req);
  const wait = await rateLimitRemaining(to, ip);
  if (wait > 0) return NextResponse.json({ error: "Lütfen yeni kod istemeden önce 60 saniye bekleyin.", retryAfter: wait }, { status: 429 });
  const code = await createCode(to, type, ip);
  if (!(await sendVerificationCodeEmail({ to, code, type }))) return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 502 });
  return NextResponse.json({ success: true, action, retryAfter: 60 });
}
