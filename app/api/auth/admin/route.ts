import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { ADMIN_COOKIE, cookieOptions, safeCompare, signSession } from "@/lib/session";

// Yönetici girişi: .env (ADMIN_USER / ADMIN_PASSWORD) veya veritabanındaki ADMIN rolüne sahip hesapla doğrular
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
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
    ok = !!user && user.role === "ADMIN" && verifyPassword(password, user.password);
  }

  if (!ok) return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, await signSession({ role: "admin" }), cookieOptions);
  return res;
}
