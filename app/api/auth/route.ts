import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/account";
import { getCustomerWithOrders } from "@/lib/customer";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendVerificationCodeEmail } from "@/lib/email";
import { USER_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { EMAIL_RE, isStrongPassword } from "@/lib/validation";
import { clientIp, createCode, issueProof, rateLimitRemaining, readProof } from "@/lib/verification";

const GUEST_PASSWORD = "guest_checkout";
const WEAK = "Şifre en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermelidir.";

async function respond(userId: string) {
  const res = NextResponse.json({ success: true, user: await getCustomerWithOrders(userId) });
  res.cookies.set(USER_COOKIE, await signSession({ uid: userId }), cookieOptions);
  return res;
}

const findByEmail = (email: string) => prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // Giriş: şifre doğruysa ve 2FA açıksa oturum açılmaz, e-postaya kod gider
    if (action === "login") {
      const rl = rateLimit(req, "user-login", 10, 15 * 60_000);
      if (rl.limited) return tooMany(rl.retryAfter);
      if (!email || !password) return NextResponse.json({ error: "E-posta ve şifre zorunludur" }, { status: 400 });
      const user = await findByEmail(email);
      if (!user || user.password === GUEST_PASSWORD || !verifyPassword(password, user.password)) {
        return NextResponse.json({ error: "Geçersiz e-posta veya şifre." }, { status: 401 });
      }
      if (!user.twoFactorEnabled) return respond(user.id);

      const ip = clientIp(req);
      const wait = await rateLimitRemaining(email, ip);
      if (wait > 0) {
        // Kod zaten yakın zamanda gönderildi; kullanıcı mevcut kodla devam edebilir
        return NextResponse.json({ twoFactor: true, pendingToken: await issueProof(email, "2fa-login", user.id), retryAfter: wait });
      }
      const code = await createCode(email, "TWO_FACTOR_LOGIN", ip);
      if (!(await sendVerificationCodeEmail({ to: email, code, type: "TWO_FACTOR_LOGIN" }))) {
        return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin." }, { status: 502 });
      }
      return NextResponse.json({ twoFactor: true, pendingToken: await issueProof(email, "2fa-login", user.id), retryAfter: 60 });
    }

    // Kayıt: e-posta kodu doğrulanmış olmalı. Misafir siparişinden kalan hesap, e-posta doğrulandığı için şifreyle devralınır.
    if (action === "register") {
      if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
      if (!(await readProof(body.proof, email, "REGISTER"))) {
        return NextResponse.json({ error: "E-posta doğrulaması gerekli veya süresi doldu." }, { status: 403 });
      }
      if (!isStrongPassword(password)) return NextResponse.json({ error: WEAK }, { status: 400 });
      const existing = await findByEmail(email);
      if (existing && existing.password !== GUEST_PASSWORD) {
        return NextResponse.json({ error: "Bu e-posta adresiyle zaten bir hesap var. Lütfen giriş yapın." }, { status: 400 });
      }
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Müşteri";
      const user = existing
        ? await prisma.user.update({ where: { id: existing.id }, data: { password: hashPassword(password), name } })
        : await prisma.user.create({ data: { name, email, password: hashPassword(password), role: "USER" } });
      return respond(user.id);
    }

    // Şifremi unuttum: e-posta kodu doğrulanmış olmalı
    if (action === "reset") {
      if (!(await readProof(body.proof, email, "RESET_PASSWORD"))) {
        return NextResponse.json({ error: "E-posta doğrulaması gerekli veya süresi doldu." }, { status: 403 });
      }
      if (!isStrongPassword(password)) return NextResponse.json({ error: WEAK }, { status: 400 });
      const user = await findByEmail(email);
      if (!user) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
      return NextResponse.json({ success: true });
    }

    // Profilden şifre değiştirme: oturum + e-posta kodu kanıtı
    if (action === "change-password") {
      const uid = await getSessionUserId();
      const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
      if (!user) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });
      const proof = await readProof(body.proof, user.email.toLowerCase(), "CHANGE_PASSWORD");
      if (!proof || proof.uid !== user.id) {
        return NextResponse.json({ error: "E-posta doğrulaması gerekli veya süresi doldu." }, { status: 403 });
      }
      if (!isStrongPassword(password)) return NextResponse.json({ error: WEAK }, { status: 400 });
      await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
      return NextResponse.json({ success: true });
    }

    // 2FA'yı kapat (oturum açık kullanıcı)
    if (action === "disable-2fa") {
      const uid = await getSessionUserId();
      if (!uid) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });
      await prisma.user.update({ where: { id: uid }, data: { twoFactorEnabled: false } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
