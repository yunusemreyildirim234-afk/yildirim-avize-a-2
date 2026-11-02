import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { syncShippedOrders } from "@/lib/shipment-sync";

export const maxDuration = 60;

// Yönetici: kargodaki (SHIPPED) siparişleri Kargonomi ile senkronize eder; teslim edilenler DELIVERED olur (en fazla 50 sipariş/çağrı)
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "shipment-sync", 6, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  try {
    return NextResponse.json({ success: true, ...(await syncShippedOrders(50)) });
  } catch (e) {
    console.error("[admin/kargonomi/sync] hata:", (e as Error).message);
    return NextResponse.json({ error: "Senkronizasyon tamamlanamadı." }, { status: 502 });
  }
}
