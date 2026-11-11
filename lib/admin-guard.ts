import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";

/** Savunma derinliği: proxy.ts'e ek olarak her admin handler'ı oturumu kendisi de doğrular. Yetkisizse 401 yanıtı döner. */
export async function adminGuard(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return (await verifyAdminSession(token)) ? null : NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
}

/** Sayfa düzeyinde ikinci oturum denetimi (proxy.ts atlanırsa müşteri verisi oturumsuz render olmasın). Oturum yoksa yönetici girişine yönlendirir. */
export async function requireAdminPage(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await verifyAdminSession(token))) redirect("/giris?tab=yonetici");
}
