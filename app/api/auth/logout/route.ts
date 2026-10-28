import { NextResponse } from "next/server";
import { ADMIN_COOKIE, USER_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
