import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomerProfile, getCustomerWithOrders } from "@/lib/customer";
import { ADMIN_COOKIE, USER_COOKIE, verifyAdminSession, verifySession } from "@/lib/session";

// Mevcut müşteri ve yönetici oturum durumunu döndürür
export async function GET(req: Request) {
  const withOrders = new URL(req.url).searchParams.get("orders") === "1";
  const jar = await cookies();
  const [userSession, adminSession] = await Promise.all([
    verifySession<{ uid: string; picture?: string | null }>(jar.get(USER_COOKIE)?.value),
    verifyAdminSession(jar.get(ADMIN_COOKIE)?.value),
  ]);

  const user = userSession ? (withOrders ? await getCustomerWithOrders(userSession.uid) : await getCustomerProfile(userSession.uid)) : null;
  return NextResponse.json({
    user: user ? { ...user, picture: userSession?.picture ?? null } : null,
    admin: Boolean(adminSession),
  });
}
