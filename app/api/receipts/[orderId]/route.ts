import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Dekont yalnızca yöneticiye veya siparişin sahibine açıktır
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const isAdmin = Boolean(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value));
  if (!isAdmin) {
    // Yönetici dekontları art arda inceleyebilir; sınır yalnızca müşteri tarafında
    const rl = rateLimit(req, "receipt-download", 30, 10 * 60_000);
    if (rl.limited) return tooMany(rl.retryAfter);
    const uid = await getSessionUserId();
    const owner = uid ? await prisma.order.findFirst({ where: { id: orderId, userId: uid }, select: { id: true } }) : null;
    if (!owner) return new Response("Yetkisiz", { status: 403 });
  }
  const file = await prisma.receiptFile.findUnique({ where: { orderId } });
  if (!file) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.mime, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
