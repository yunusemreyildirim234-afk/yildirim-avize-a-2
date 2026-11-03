import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isStrongPassword } from "@/lib/validation";
import { sendPasswordChangedEmail, sendVerificationCodeEmail } from "@/lib/email";
import { clientIp, consumeCode, createCode, rateLimitRemaining } from "@/lib/verification";
import { bumpUserSessionVersion } from "@/lib/account";
import { revokeAdminSessions } from "@/lib/admin-session";
import { passwordChangeError } from "@/lib/admin-password";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/session";

// Yönetici hesabı (role=ADMIN User) şifre değiştirme: e-posta + mevcut şifre + yeni şifre + e-posta kodu (ADMIN_PASSWORD).
// .env ortak kimliği bir User değildir; burada reddedilir. Başarıda: şifre güncellenir, hesabın sessionVersion'ı ve admin oturum sürümü artar
// (tüm yönetici çerezleri geçersiz), işlemi yapanın çerezi yeni sürümle yenilenir, hesap sahibine bilgi e-postası gider.
// Adım "send": kod gönderir (yeni şifre kuralları burada da denetlenir); adım "change": kodu tüketir ve şifreyi değiştirir.
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-password", 10, 15 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const newPassword = str(body.newPassword);
  const confirm = str(body.confirm);
  if (!email || !password) return NextResponse.json({ error: "E-posta ve mevcut şifre zorunludur." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, role: "ADMIN" },
    select: { id: true, email: true, role: true, password: true },
  });
  // Kod tüketilmeden önce: hesap/rol, mevcut şifre, yeni şifre kuralları, tekrar eşleşmesi
  const bad = passwordChangeError({ account: user, currentOk: !!user && verifyPassword(password, user.password), strong: isStrongPassword(newPassword), newPassword, confirm });
  if (bad || !user) return NextResponse.json({ error: bad?.error ?? "Hesap bulunamadı." }, { status: bad?.status ?? 401 });
  const to = user.email.toLowerCase();

  if (body.step === "change") {
    const code = str(body.code).replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "6 haneli kodu giriniz." }, { status: 400 });
    // consumeCode: 10 dk geçerlilik, 5 yanlış denemede kod yanar
    if (!(await consumeCode(to, "ADMIN_PASSWORD", code))) return NextResponse.json({ error: "Doğrulama kodu hatalı veya süresi dolmuş." }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(newPassword) } });
    await bumpUserSessionVersion(user.id);
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, await revokeAdminSessions(), cookieOptions); // diğer yönetici çerezleri geçersiz; bu oturum yenilenir
    await sendPasswordChangedEmail(to).catch(() => false);
    return res;
  }

  const ip = clientIp(req);
  const wait = await rateLimitRemaining(to, ip, "ADMIN_PASSWORD");
  if (wait > 0) return NextResponse.json({ error: "Lütfen yeni kod istemeden önce 60 saniye bekleyin.", retryAfter: wait }, { status: 429 });
  const code = await createCode(to, "ADMIN_PASSWORD", ip);
  if (!(await sendVerificationCodeEmail({ to, code, type: "ADMIN_PASSWORD" }))) return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 502 });
  return NextResponse.json({ success: true, retryAfter: 60 });
}
