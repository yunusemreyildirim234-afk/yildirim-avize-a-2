import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { restoreOrderStock } from "@/lib/orders";
import { releaseCoupon } from "@/lib/coupons";
import { signSession } from "@/lib/session";

const STATUS_NOTICE: Record<string, string> = {
  PENDING: "Siparişiniz hazırlanıyor.",
  READY_FOR_PICKUP: "Siparişiniz mağazada teslime hazır.",
  SHIPPED: "Siparişiniz kargoya verildi.",
  DELIVERED: "Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!",
};

const VALID_STATUSES = ["PENDING", "PENDING_NEW", "AWAITING_PAYMENT", "PAYMENT_FAILED", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { orderId, status } = await req.json();

    if (typeof orderId !== "string" || typeof status !== "string" || !orderId || !status) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Geçersiz sipariş durumu." }, { status: 400 });
    }

    const before = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!before) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // Doğrudan iptal/iade: düşülmüş stok geri eklenir, kupon hakkı iade edilir (yalnızca durum ilk kez değiştiğinde)
    // Stok yalnızca ödemesi/rezervasyonu alınmış siparişte düşülmüştür; AWAITING_PAYMENT/PAYMENT_FAILED iptalinde iade yapılmaz
    const NO_STOCK_STATES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"];
    const restoredStock = ["CANCELLED", "RETURNED"].includes(status) && !NO_STOCK_STATES.includes(before.status);
    if (restoredStock) {
      await restoreOrderStock(orderId);
      await releaseCoupon(updatedOrder.couponCode).catch(() => {});
    }
    // Ödeme bekleyen siparişte stok düşülmemiştir ama kupon hakkı sipariş anında ayrılmıştır; iptal/iadede kupon geri verilir.
    // (PAYMENT_FAILED/CANCELLED/RETURNED siparişte kupon zaten iade edilmiştir.)
    const releasedCouponOnly = !restoredStock && ["CANCELLED", "RETURNED"].includes(status) && before.status === "AWAITING_PAYMENT";
    if (releasedCouponOnly) await releaseCoupon(updatedOrder.couponCode).catch(() => {});

    const notified = before.status !== status && Boolean(STATUS_NOTICE[status]);
    if (notified) {
      await notifyCustomer(
        { userId: updatedOrder.userId },
        { title: "Sipariş durumunuz güncellendi", message: `#${orderId.slice(0, 8)}: ${STATUS_NOTICE[status]}`, type: "ORDER", link: "/giris#siparisler" }
      );
    }

    // Geri Al belirteci: yalnızca durum gerçekten değiştiyse. Stok/kupon iadesi yapıldıysa geri alırken tersine çevrilir.
    const undoToken =
      before.status !== status
        ? await signSession({ kind: "order-undo", iat: Date.now(), orderId, from: before.status, to: status, restoredStock, coupon: restoredStock || releasedCouponOnly ? updatedOrder.couponCode : null })
        : null;
    return NextResponse.json({ success: true, order: updatedOrder, undoToken, notified });
  } catch (error) {
    return serverError("admin/order-status", error);
  }
}