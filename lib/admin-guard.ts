import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";

/** Savunma derinliği: proxy.ts'e ek olarak her admin handler'ı oturumu kendisi de doğrular. Yetkisizse 401 yanıtı döner. */
export async function adminGuard(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return (await verifyAdminSession(token)) ? null : NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
}
