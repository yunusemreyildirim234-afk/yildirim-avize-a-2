import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { sendShippedEmail } from "@/lib/email";
import { refreshOrderShipment } from "@/lib/kargonomi";
import { decideShippedTracking } from "@/lib/shipped-tracking";
import { cleanGuestEmail } from "@/lib/guest-email";
import { buildShippedNotice, buildShippedNoticeForced } from "@/lib/shipped-notice";
import { forceReserveCoupon, releaseCoupon } from "@/lib/coupons";
import { signSession } from "@/lib/session";
import { ORDER_STATUSES, StatusRefusal, applyStatusChangeInTx, type StatusChangeTx } from "@/lib/order-undo";
import { STOREFRONT_UNCHANGED, statusChangeTouchesStorefront } from "@/lib/revalidate-rule";

const STATUS_NOTICE: Record<string, string> = {
  PENDING: "Siparişiniz hazırlanıyor.",
  READY_FOR_PICKUP: "Siparişiniz mağazada teslime hazır.",
  SHIPPED: "Siparişiniz kargoya verildi.",
  DELIVERED: "Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkürler!",
};

const VALID_STATUSES = ORDER_STATUSES;

// Kargonomi yenilemesi (en çok 2 deneme, aralarında 2 sn) süre alabilir
export const maxDuration = 30;

async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { orderId, status, force } = await req.json();

    if (typeof orderId !== "string" || typeof status !== "string" || !orderId || !status) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Geçersiz sipariş durumu." }, { status: 400 });
    }

    // Kargoya verilirken gerçek takip kodu güvencesi (yalnız standart kargo): kod yoksa yönetici onayı istenir, hiçbir şey yazılmaz
    let forcedShipped = false;
    if (status === "SHIPPED") {
      const pre = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, shippingType: true, shippingTrackingCode: true, shippingBarcode: true, kargonomiShipmentId: true } });
      if (pre) {
        const decision = await decideShippedTracking(pre, orderId, force === true, { refresh: refreshOrderShipment, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
        if (decision.action === "pending") {
          return NextResponse.json({ success: false, code: "TRACKING_PENDING", barcodeMissing: decision.barcodeMissing, error: decision.message }, { status: 409 });
        }
        forcedShipped = decision.forced;
      }
    }

    // Durum + stok + kupon tek transaction'da: biri hata verirse hiçbiri uygulanmaz (lib/order-undo.ts).
    // Geçiş tablosu (ALLOWED_TRANSITIONS) burada uygulanır; yeniden açmada stok koşullu düşülür, kupon koşulsuz yeniden sayılır.
    const result = await prisma
      .$transaction(
        (tx) =>
          applyStatusChangeInTx(tx as unknown as StatusChangeTx, orderId, status, (code) => releaseCoupon(code, tx), {
            deduct: async (variationId, quantity) => (await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${quantity} WHERE "id" = ${variationId} AND "stock" >= ${quantity}`) > 0,
            reserve: (code) => forceReserveCoupon(tx, code),
          }),
        { maxWait: 5000, timeout: 10000 }
      )
      .catch((e) => {
        if (e instanceof StatusRefusal) return { outcome: "REFUSED" as const, message: e.message };
        throw e;
      });
    if (result.outcome === "NOT_FOUND") return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (result.outcome === "FORBIDDEN" || result.outcome === "REFUSED") return NextResponse.json({ success: false, error: result.message }, { status: 409 });
    if (result.outcome === "CONFLICT") return NextResponse.json({ success: false, alreadyUpdated: true, error: "Sipariş zaten güncellendi (başka bir işlem durumu değiştirdi). Sayfayı yenileyin." }, { status: 409 });
    const before = { status: result.from };
    const { plan } = result;
    const restoredStock = plan.restoreStock;
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    const notified = before.status !== status && Boolean(STATUS_NOTICE[status]);
    // Kargoya verildi (standart kargo + takip kodu var): bildirime firma ve takip no eklenir, e-posta gönderilir
    const shippedNotice = before.status !== status && status === "SHIPPED" ? (forcedShipped ? buildShippedNoticeForced(updatedOrder) : buildShippedNotice(updatedOrder)) : null;
    if (notified) {
      await notifyCustomer(
        { userId: updatedOrder.userId },
        shippedNotice
          ? { title: "Sipariş durumunuz güncellendi", message: shippedNotice.message(orderId), type: "ORDER", link: shippedNotice.link }
          : { title: "Sipariş durumunuz güncellendi", message: `#${orderId.slice(0, 8)}: ${STATUS_NOTICE[status]}`, type: "ORDER", link: "/giris#siparisler" }
      );
    }
    if (shippedNotice) {
      try {
        const user = await prisma.user.findUnique({ where: { id: updatedOrder.userId }, select: { email: true, name: true } });
        if (user) {
          await sendShippedEmail({ to: cleanGuestEmail(user.email), name: user.name, orderId, carrier: shippedNotice.carrier, trackingNumber: shippedNotice.tracking, trackingKind: shippedNotice.trackingKind });
        }
      } catch (e) {
        console.warn("Kargo e-postası gönderilemedi:", (e as Error).message);
      }
    }

    // Geri Al belirteci: yalnızca durum gerçekten değiştiyse. Stok/kupon iadesi yapıldıysa geri alırken tersine çevrilir.
    // Yeniden açmada (stok düşüldü / kupon yeniden sayıldı) belirteç ÜRETİLMEZ: Geri Al bu işlemleri tersine çeviremez;
    // vazgeçilirse sipariş normal geçişle yeniden İptal yapılır (stok ve kupon o geçişte iade edilir).
    const undoToken =
      before.status !== status && !plan.ensureStock && !plan.reserveCoupon
        ? await signSession({ kind: "order-undo", iat: Date.now(), orderId, from: before.status, to: status, restoredStock, coupon: plan.releaseCoupon ? updatedOrder.couponCode : null })
        : null;
    // Stok oynamadıysa (ör. hazırlanıyor → kargoda → teslim) vitrin önbelleği boşaltılmaz
    return NextResponse.json({ success: true, order: updatedOrder, undoToken, notified }, statusChangeTouchesStorefront(plan) ? undefined : STOREFRONT_UNCHANGED);
  } catch (error) {
    return serverError("admin/order-status", error);
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);
