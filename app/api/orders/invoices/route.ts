import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { getInvoiceMeta } from "@/lib/invoice";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Siparişlerim: faturası yüklenmiş siparişlerin kimlikleri. Ana sipariş sorgusundan ayrıdır; hata veya tablo yoksa boş liste döner.
export async function GET(req: Request) {
  const rl = rateLimit(req, "invoice-list", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ orderIds: [] });
  try {
    const orders = await prisma.order.findMany({
      where: { userId: uid, status: "DELIVERED", user: { password: { not: "guest_checkout" } } },
      select: { id: true },
    });
    const meta = await getInvoiceMeta(orders.map((o) => o.id));
    return NextResponse.json({ orderIds: Object.keys(meta.byOrder) });
  } catch {
    return NextResponse.json({ orderIds: [] });
  }
}
