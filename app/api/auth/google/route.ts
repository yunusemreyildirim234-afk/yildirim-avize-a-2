import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

// Google OAuth akışını başlatır; istemci kimliği sunucu tarafında .env'den okunur
export async function GET() {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${SITE_URL}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("ya_oauth_state", state, { httpOnly: true, secure: SITE_URL.startsWith("https"), sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
