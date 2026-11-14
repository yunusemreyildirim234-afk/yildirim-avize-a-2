import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { recipientLabel } from "@/lib/recipient";

// Yönetim paneli canlı uyarıları: son 24 saatteki yeni siparişler ve bekleyen sorular (proxy yalnızca yöneticiye açar)
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Özet modu (?ozet=1): liste yok; bekleyen sipariş/soru sayısı + en yeni kayıt tarihi
  if (new URL(req.url).searchParams.get("ozet") === "1") {
    const [o, m] = await Promise.all([
      prisma.order.aggregate({ where: { createdAt: { gte: since }, status: { in: ["PENDING", "PENDING_NEW"] } }, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.contactMessage.aggregate({ where: { createdAt: { gte: since }, status: "PENDING" }, _count: { _all: true }, _max: { createdAt: true } }),
    ]);
    const dates = [o._max.createdAt, m._max.createdAt].filter((d): d is Date => d !== null);
    const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null;
    return NextResponse.json({ orders: o._count._all, messages: m._count._all, latest });
  }
  const [orders, messages] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { in: ["PENDING", "PENDING_NEW"] } },
      select: { id: true, totalAmount: true, recipientName: true, user: { select: { name: true } } },
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
    orders: orders.map((o) => ({ id: o.id, total: o.totalAmount, customer: recipientLabel(o) })),
    messages: messages.map((m) => ({ id: m.id, name: m.name, topic: m.product?.title || m.subject || "Genel" })),
  });
}
