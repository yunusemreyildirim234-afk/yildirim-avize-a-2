import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";

// /admin, /api/admin ve /api/seed yalnızca aktif yönetici oturumuna açıktır.
export async function proxy(request: NextRequest) {
  if (await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/giris?tab=yonetici", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/seed"],
};
