import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeCompare } from "@/lib/session";
import { runDailyCleanup } from "@/lib/cleanup-rules";

// Günlük veri temizliği (vercel.json): süresi 1 günden eski doğrulama kodları ve 90 günden eski okunmuş bildirimler.
// Vercel Cron "Authorization: Bearer $CRON_SECRET" gönderir; CRON_SECRET tanımlı değilse uç kapalıdır.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeCompare(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const result = await runDailyCleanup(prisma);
  if (result.errors.length) console.error("[cron/cleanup]", result.errors.join("; "));
  return NextResponse.json({ success: result.errors.length === 0, ...result });
}
