import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";

const STATUS_NOTICE: Record<string, string> = {
  PENDING: "Siparişiniz hazırlanıyor.",
  READY_FOR_PICKUP: "Siparişiniz mağazada teslime hazır.",
  SHIPPED: "Siparişiniz kargoya verildi.",
  DELIVERED: "Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!",
};

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }

    const before = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    if (before?.status !== status && STATUS_NOTICE[status]) {
      await notifyCustomer(
        { userId: updatedOrder.userId },
        { title: "Sipariş durumunuz güncellendi", message: `#${orderId.slice(0, 8)}: ${STATUS_NOTICE[status]}`, type: "ORDER", link: "/giris#siparisler" }
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}