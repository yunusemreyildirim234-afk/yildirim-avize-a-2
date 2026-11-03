import { NextResponse } from "next/server";
import { bumpUserSessionVersion, getSessionUserId, getUserSession, issueUserToken } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { USER_COOKIE, cookieOptions } from "@/lib/session";

// "Tüm cihazlardan çıkış yap": oturum sürümü artar, bu cihazın oturumu yeni sürümle yenilenir (kullanıcı kendi oturumundan atılmaz)
export async function POST(req: Request) {
  const rl = rateLimit(req, "logout-all", 5, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });
  const picture = (await getUserSession())?.picture;
  await bumpUserSessionVersion(uid);
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, await issueUserToken(uid, picture ? { picture } : {}), cookieOptions);
  return res;
}
