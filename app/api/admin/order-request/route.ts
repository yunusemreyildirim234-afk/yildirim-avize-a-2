import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendRequestDecisionEmail } from "@/lib/email";
import { restoreOrderStock } from "@/lib/orders";

// Yönetici iptal/iade talebini onaylar veya reddeder (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const approve = body.decision === "APPROVE";
  const reject = body.decision === "REJECT";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!orderId || (!approve && !reject)) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !order.cancelReturnType) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  if (order.cancelReturnStatus !== "PENDING") return NextResponse.json({ error: "Talep zaten sonuçlandırılmış." }, { status: 409 });

  const isCancel = order.cancelReturnType === "CANCEL";
  await prisma.order.update({
    where: { id: orderId },
    data: {
      cancelReturnStatus: approve ? "APPROVED" : "REJECTED",
      cancelReturnNote: note || null,
      // Onayda sipariş durumu da güncellenir; reddedilirse mevcut durum korunur
      ...(approve ? { status: isCancel ? "CANCELLED" : "RETURNED" } : {}),
    },
  });

  // Onaylanan iptalde sipariş stoğu geri eklenir
  if (approve && isCancel) await restoreOrderStock(orderId);

  const emailed = await sendRequestDecisionEmail({
    to: order.user.email,
    name: order.user.name,
    type: order.cancelReturnType,
    approved: approve,
    orderId,
    note,
  }).catch(() => false);

  return NextResponse.json({ success: true, emailed });
}
