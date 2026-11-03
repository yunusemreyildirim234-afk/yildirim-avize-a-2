import { NextResponse } from "next/server";
import { revokeAdminSessions } from "@/lib/admin-session";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/session";

// "Tüm yönetici oturumlarını kapat": sürüm artar, işlemi yapanın oturumu yeni sürümle yenilenir
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-revoke", 5, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, await revokeAdminSessions(), cookieOptions);
  return res;
}
