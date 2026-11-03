import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ADMIN_COOKIE, cookieOptions, safeCompare } from "@/lib/session";
import { issueAdminToken } from "@/lib/admin-session";
import { sendVerificationCodeEmail } from "@/lib/email";
import { clientIp, consumeCode, createCode, issueProof, rateLimitRemaining, readProof } from "@/lib/verification";
import { ADMIN_2FA_PURPOSE, canVerifyAdminCode, planAdminLogin } from "@/lib/admin-2fa";

// Kullanıcı bulunamadığında da aynı maliyetli scrypt doğrulaması çalışsın (hesap varlığı zamanlamadan anlaşılmasın)
const DUMMY_HASH = hashPassword("dummy-admin-login-timing");

const BAD_CODE = "Doğrulama kodu hatalı veya süresi dolmuş. Çok sayıda hatalı denemeden sonra kod iptal olur; yeni kod isteyin.";
const EXPIRED = "Oturum süresi doldu. Lütfen şifrenizle yeniden giriş yapın.";

const findAdmin = (email: string) =>
  prisma.user
    .findFirst({ where: { email: { equals: email, mode: "insensitive" }, role: "ADMIN" }, select: { id: true, email: true, role: true, twoFactorEnabled: true } })
    .catch(() => null);

async function sendLoginCode(req: Request, email: string) {
  const ip = clientIp(req);
  const wait = await rateLimitRemaining(email, ip);
  if (wait > 0) return { ok: true as const, retryAfter: wait }; // kod yakın zamanda gönderildi; mevcut kodla devam edilir
  const code = await createCode(email, "ADMIN_LOGIN", ip);
  if (!(await sendVerificationCodeEmail({ to: email, code, type: "ADMIN_LOGIN" }))) return { ok: false as const };
  return { ok: true as const, retryAfter: 60 };
}

// Yönetici girişi: .env (ADMIN_USER / ADMIN_PASSWORD) veya veritabanındaki ADMIN rolüne sahip hesapla doğrular.
// Giriş adı bir yönetici hesabının e-postasıysa ve o hesapta 2FA açıksa, şifreden sonra e-posta kodu istenir; kod doğrulanmadan çerez verilmez.
export async function POST(req: Request) {
  const rl = rateLimit(req, "admin-login", 10, 15 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;

  // 2. adım: kod doğrulama / yeniden gönderme (bekleyen jeton şifre adımından gelir)
  if (body.step === "verify" || body.step === "resend") {
    const rl2 = rateLimit(req, "admin-2fa", 10, 15 * 60_000);
    if (rl2.limited) return tooMany(rl2.retryAfter);
    const email = typeof username === "string" ? username.trim().toLowerCase() : "";
    const pending = email ? await readProof(body.pendingToken, email, ADMIN_2FA_PURPOSE) : null;
    const account = email && pending ? await findAdmin(email) : null;
    if (!pending || !canVerifyAdminCode(account, pending.uid)) return NextResponse.json({ error: EXPIRED }, { status: 401 });

    if (body.step === "resend") {
      const sent = await sendLoginCode(req, email);
      if (!sent.ok) return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin." }, { status: 502 });
      return NextResponse.json({ twoFactor: true, retryAfter: sent.retryAfter });
    }
    const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "6 haneli kodu giriniz." }, { status: 400 });
    if (!(await consumeCode(email, "ADMIN_LOGIN", code))) return NextResponse.json({ error: BAD_CODE }, { status: 400 });
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, await issueAdminToken(), cookieOptions);
    return res;
  }

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return NextResponse.json({ error: "Kullanıcı adı ve şifre zorunludur." }, { status: 400 });
  }
  const login = username.trim();

  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASSWORD;
  let ok = !!adminUser && !!adminPass && safeCompare(login, adminUser) && safeCompare(password, adminPass);

  if (!ok) {
    const user = await prisma.user
      .findUnique({ where: { email: login.toLowerCase() } })
      .catch(() => null);
    const passOk = verifyPassword(password, user?.password ?? DUMMY_HASH);
    ok = !!user && user.role === "ADMIN" && passOk;
  }

  const account = ok ? await findAdmin(login.toLowerCase()) : null;
  const plan = planAdminLogin(ok, account);
  if (plan === "DENY") return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });

  if (plan === "NEED_CODE" && account) {
    const email = account.email.toLowerCase();
    const sent = await sendLoginCode(req, email);
    if (!sent.ok) return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin." }, { status: 502 });
    // Çerez VERİLMEZ; yalnızca kod adımı için imzalı bekleyen jeton
    return NextResponse.json({ twoFactor: true, pendingToken: await issueProof(email, ADMIN_2FA_PURPOSE, account.id), username: email, retryAfter: sent.retryAfter });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, await issueAdminToken(), cookieOptions);
  return res;
}
