import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Yönetim paneli canlı uyarıları: son 24 saatteki yeni siparişler ve bekleyen sorular (proxy yalnızca yöneticiye açar)
export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [orders, messages] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { in: ["PENDING", "PENDING_NEW"] } },
      select: { id: true, totalAmount: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.contactMessage.findMany({
      where: { createdAt: { gte: since }, status: "PENDING" },
      select: { id: true, name: true, kind: true, subject: true, product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return NextResponse.json({
    orders: orders.map((o) => ({ id: o.id, total: o.totalAmount, customer: o.user.name })),
    messages: messages.map((m) => ({ id: m.id, name: m.name, topic: m.product?.title || m.subject || "Genel" })),
  });
}
