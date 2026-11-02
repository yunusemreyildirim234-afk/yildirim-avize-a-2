import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { restoreOrderStock } from "@/lib/orders";
import { releaseCoupon } from "@/lib/coupons";

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

    // Doğrudan iptal/iade: düşülmüş stok geri eklenir, kupon hakkı iade edilir (yalnızca durum ilk kez değiştiğinde)
    // Stok yalnızca ödemesi/rezervasyonu alınmış siparişte düşülmüştür; AWAITING_PAYMENT/PAYMENT_FAILED iptalinde iade yapılmaz
    const NO_STOCK_STATES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"];
    if (["CANCELLED", "RETURNED"].includes(status) && before && !NO_STOCK_STATES.includes(before.status)) {
      await restoreOrderStock(orderId);
      await releaseCoupon(updatedOrder.couponCode).catch(() => {});
    }

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