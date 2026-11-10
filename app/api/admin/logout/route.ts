import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { ADMIN_COOKIE } from "@/lib/session";

// "Yönetici çıkışı": yalnızca yönetici oturum çerezini siler; aynı tarayıcıdaki müşteri oturumuna (USER_COOKIE) dokunmaz.
// (/api/auth/logout ikisini birden kapatır; mağaza menüsündeki "Çıkış Yap" onu kullanır.)
export async function POST() {
  const denied = await adminGuard();
  if (denied) return denied;
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
