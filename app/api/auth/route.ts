import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomerWithOrders } from "@/lib/customer";
import { hashPassword, verifyPassword } from "@/lib/password";
import { USER_COOKIE, cookieOptions, signSession } from "@/lib/session";

const GUEST_PASSWORD = "guest_checkout";

async function respond(userId: string) {
  const res = NextResponse.json({ success: true, user: await getCustomerWithOrders(userId) });
  res.cookies.set(USER_COOKIE, await signSession({ uid: userId }), cookieOptions);
  return res;
}

export async function POST(req: Request) {
  try {
    const { action, name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-posta ve şifre zorunludur" }, { status: 400 });
    }
    if (action === "register" && String(password).length < 6) {
      return NextResponse.json({ error: "Şifre en az 6 karakter olmalıdır." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (action === "register") {
      if (existing?.password === GUEST_PASSWORD) {
        return NextResponse.json(
          { error: "Bu e-posta ile misafir sipariş verilmiş. Siparişlerinize erişmek için Google ile giriş yapabilirsiniz." },
          { status: 400 }
        );
      }
      if (existing) {
        return NextResponse.json({ error: "Bu e-posta adresiyle zaten bir hesap var. Lütfen giriş yapın." }, { status: 400 });
      }
      const created = await prisma.user.create({
        data: { name: name || "Müşteri", email, password: hashPassword(password), role: "USER" },
      });
      return respond(created.id);
    }

    if (action === "login") {
      if (!existing || existing.password === GUEST_PASSWORD || !verifyPassword(password, existing.password)) {
        return NextResponse.json({ error: "Geçersiz e-posta veya şifre." }, { status: 401 });
      }
      return respond(existing.id);
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
