import { NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, safeCompare, signSession } from "@/lib/session";

// Yönetici girişi: .env içindeki ADMIN_USER / ADMIN_PASSWORD ile doğrular
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass) {
    return NextResponse.json({ error: "Yönetici girişi yapılandırılmamış." }, { status: 503 });
  }
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !safeCompare(username, adminUser) ||
    !safeCompare(password, adminPass)
  ) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, await signSession({ role: "admin" }), cookieOptions);
  return res;
}
