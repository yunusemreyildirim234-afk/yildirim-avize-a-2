import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { getCustomerProfile, getCustomerWithOrders } from "@/lib/customer";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { getUserSession } from "@/lib/account";

// Mevcut müşteri ve yönetici oturum durumunu döndürür
export async function GET(req: Request) {
  const rl = rateLimit(req, "auth-me", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const withOrders = new URL(req.url).searchParams.get("orders") === "1";
  const jar = await cookies();
  const [userSession, adminSession] = await Promise.all([
    getUserSession(),
    verifyAdminSession(jar.get(ADMIN_COOKIE)?.value),
  ]);

  const user = userSession ? (withOrders ? await getCustomerWithOrders(userSession.uid) : await getCustomerProfile(userSession.uid)) : null;
  return NextResponse.json({
    user: user ? { ...user, picture: userSession?.picture ?? null } : null,
    admin: Boolean(adminSession),
  });
}
