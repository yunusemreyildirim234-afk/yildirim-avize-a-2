import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ADMIN_COOKIE, USER_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const rl = rateLimit(req, "auth-logout", 60, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const res = NextResponse.json({ success: true });
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
