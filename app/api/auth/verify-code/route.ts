import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { getCustomerWithOrders } from "@/lib/customer";
import { USER_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { consumeCode, issueProof, readProof, type CodeType } from "@/lib/verification";

const BAD = () => NextResponse.json({ error: "Doğrulama kodu hatalı veya süresi dolmuş." }, { status: 400 });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const type = body.type as CodeType;
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "6 haneli kodu giriniz." }, { status: 400 });

  switch (type) {
    case "REGISTER":
    case "RESET_PASSWORD": {
      if (!(await consumeCode(email, type, code))) return BAD();
      return NextResponse.json({ success: true, proof: await issueProof(email, type) });
    }

    case "CHANGE_PASSWORD":
    case "TWO_FACTOR_ENABLE": {
      const uid = await getSessionUserId();
      const user = uid ? await prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true } }) : null;
      if (!user) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });
      email = user.email.toLowerCase();
      if (!(await consumeCode(email, type, code))) return BAD();
      if (type === "TWO_FACTOR_ENABLE") {
        await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: true, proof: await issueProof(email, type, user.id) });
    }

    case "TWO_FACTOR_LOGIN": {
      // Şifresi doğrulanmış (bekleyen) girişin jetonu şarttır
      const pending = await readProof(body.pendingToken, email, "2fa-login");
      if (!pending?.uid) return NextResponse.json({ error: "Oturum süresi doldu. Lütfen tekrar giriş yapın." }, { status: 401 });
      if (!(await consumeCode(email, type, code))) return BAD();
      const res = NextResponse.json({ success: true, user: await getCustomerWithOrders(pending.uid) });
      res.cookies.set(USER_COOKIE, await signSession({ uid: pending.uid }), cookieOptions);
      return res;
    }

    default:
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
}
