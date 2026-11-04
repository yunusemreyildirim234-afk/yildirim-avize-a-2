import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { sendRequestAdminEmail } from "@/lib/email";
import { requestTypeFor } from "@/lib/orderStatus";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/notifications";
import { requestNoticeTitle } from "@/lib/request-notice";

// Teslim edilmemiş siparişte iptal, teslim edilmiş siparişte iade talebi

export async function POST(req: Request) {
  const rl = rateLimit(req, "order-request", 10, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Lütfen giriş yapın." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || order.userId !== userId) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.cancelReturnStatus) {
    return NextResponse.json({ error: "Bu sipariş için zaten bir talep oluşturulmuş." }, { status: 409 });
  }

  const type = requestTypeFor(order.status);
  if (!type) return NextResponse.json({ error: "Bu sipariş durumunda talep oluşturulamaz." }, { status: 400 });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      cancelReturnType: type,
      cancelReturnStatus: "PENDING",
      cancelReturnReason: reason || null,
      cancelReturnNote: null,
      cancelReturnAt: new Date(),
    },
  });

  // Panel bildirimi best-effort: hata talebi ve e-postayı engellemez
  await notifyAdmins({
    title: requestNoticeTitle(type, order.id),
    message: `${order.user.name}${reason ? ` • ${reason.slice(0, 120)}` : ""}`,
    type: "ORDER",
    link: "/admin#siparisler",
  }).catch((e) => console.error("[talep] panel bildirimi yazılamadı:", (e as Error).message));

  await sendRequestAdminEmail({
    type,
    orderId: order.id,
    customerName: order.user.name,
    customerEmail: order.user.email,
    reason,
  }).catch(() => false);

  return NextResponse.json({ success: true, type });
}
