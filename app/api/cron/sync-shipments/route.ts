import { NextResponse } from "next/server";
import { syncShippedOrders } from "@/lib/shipment-sync";

export const maxDuration = 60;

// Vercel Cron her çağrıda "Authorization: Bearer $CRON_SECRET" gönderir (reminders ucuyla aynı yetkilendirme). CRON_SECRET tanımlı değilse uç nokta kapalıdır.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await syncShippedOrders(50)) });
  } catch (e) {
    console.error("[cron/sync-shipments] hata:", (e as Error).message);
    return NextResponse.json({ error: "Senkronizasyon tamamlanamadı." }, { status: 500 });
  }
}
