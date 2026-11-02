import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { invoiceHeaders, isMissingTable } from "@/lib/invoice";

// Müşteri kendi (hesaba bağlı) siparişinin faturasını indirir. Misafir (üyeliksiz) siparişlerin faturası yalnızca e-posta ekiyle gider.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(req, "invoice-download", 30, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { id } = await params;
  const uid = await getSessionUserId();
  if (!uid) return new Response("Yetkisiz", { status: 403 });
  try {
    const order = await prisma.order.findFirst({
      where: { id, userId: uid, status: "DELIVERED", user: { password: { not: "guest_checkout" } } },
      select: { id: true },
    });
    if (!order) return new Response("Yetkisiz", { status: 403 });
    const inv = await prisma.orderInvoice.findUnique({ where: { orderId: id } });
    if (!inv) return new Response("Bulunamadı", { status: 404 });
    return new Response(new Uint8Array(inv.data), { headers: invoiceHeaders(inv.fileName) });
  } catch (e) {
    if (!isMissingTable(e)) console.error("[invoice] indirme hatası:", (e as Error).message);
    return new Response("Fatura şu anda kullanılamıyor", { status: 503 });
  }
}
