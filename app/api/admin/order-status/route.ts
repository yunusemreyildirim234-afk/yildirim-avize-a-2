import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { releaseCoupon } from "@/lib/coupons";
import { signSession } from "@/lib/session";
import { applyStatusChangeInTx, type StatusChangeTx } from "@/lib/order-undo";

const STATUS_NOTICE: Record<string, string> = {
  PENDING: "Siparişiniz hazırlanıyor.",
  READY_FOR_PICKUP: "Siparişiniz mağazada teslime hazır.",
  SHIPPED: "Siparişiniz kargoya verildi.",
  DELIVERED: "Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!",
};

const VALID_STATUSES = ["PENDING", "PENDING_NEW", "AWAITING_PAYMENT", "PAYMENT_FAILED", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

async function POSTHandler(req: Request) {
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

    // Durum + stok + kupon tek transaction'da: biri hata verirse hiçbiri uygulanmaz (lib/order-undo.ts)
    const result = await prisma.$transaction(
      (tx) => applyStatusChangeInTx(tx as unknown as StatusChangeTx, orderId, status, (code) => releaseCoupon(code, tx)),
      { maxWait: 5000, timeout: 10000 }
    );
    if (result.outcome === "NOT_FOUND") return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (result.outcome === "CONFLICT") return NextResponse.json({ success: false, alreadyUpdated: true, error: "Sipariş zaten güncellendi (başka bir işlem durumu değiştirdi). Sayfayı yenileyin." }, { status: 409 });
    const before = { status: result.from };
    const { plan } = result;
    const restoredStock = plan.restoreStock;
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

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
        ? await signSession({ kind: "order-undo", iat: Date.now(), orderId, from: before.status, to: status, restoredStock, coupon: plan.releaseCoupon ? updatedOrder.couponCode : null })
        : null;
    return NextResponse.json({ success: true, order: updatedOrder, undoToken, notified });
  } catch (error) {
    return serverError("admin/order-status", error);
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);
