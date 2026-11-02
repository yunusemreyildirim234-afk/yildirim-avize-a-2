import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { USER_COOKIE, cookieOptions, signSession } from "@/lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const savedState = req.headers.get("cookie")?.match(/(?:^|; )ya_oauth_state=([^;]+)/)?.[1];

  if (error || !code) {
    return NextResponse.redirect(new URL("/giris?error=google_iptal", SITE_URL));
  }

  if (!state || state !== savedState) {
    return NextResponse.redirect(new URL("/giris?error=gecersiz_istek", SITE_URL));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = `${SITE_URL}/api/auth/callback/google`;

    // 1. Google'dan Erişim Belgesi (Access Token) Alıyoruz
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Google Token Hatası:", tokenData.error, tokenData.error_description, "redirect_uri:", redirectUri);
      return NextResponse.redirect(new URL("/giris?error=token_alinamadi", SITE_URL));
    }

    // 2. Google Sunucularından Kullanıcının Gerçek Adını ve E-postasını Çekiyoruz
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json();

    if (!googleUser.email || googleUser.verified_email !== true) {
      return NextResponse.redirect(new URL("/giris?error=eposta_yok", SITE_URL));
    }

    // 3. Veritabanımızda Bu Kullanıcıyı Bul veya Sıfırdan Güvenle Kaydet
    let user = await prisma.user.findFirst({
      where: { email: { equals: googleUser.email, mode: "insensitive" } },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: googleUser.name || googleUser.email.split("@")[0],
          email: googleUser.email,
          password: "google_oauth",
          role: "USER",
        },
      });
    }

    // 4. Giriş başarılı -> imzalı oturum çerezi ile hesap sayfasına yönlendir
    const res = NextResponse.redirect(new URL("/giris", SITE_URL));
    res.cookies.delete("ya_oauth_state");
    res.cookies.set(USER_COOKIE, await signSession({ uid: user.id, picture: googleUser.picture ?? null }), cookieOptions);
    return res;
  } catch (err) {
    console.error("Google Auth Hatası:", err);
    return NextResponse.redirect(new URL("/giris?error=sunucu_hatasi", SITE_URL));
  }
}