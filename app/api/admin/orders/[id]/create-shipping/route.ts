import { cleanGuestEmail } from "@/lib/guest-email";
import { adminGuard } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KargonomiError, createShipmentForOrder, refreshOrderShipment } from "@/lib/kargonomi";
import { sendShippedEmail } from "@/lib/email";
import { notifyCustomer } from "@/lib/notifications";
import { SHIPPABLE_STATUSES, createShippingOnce } from "@/lib/shipping-claim";

/** Aras Kargo barkodunu Kargonomi'de oluşturur, siparişi "kargoya verildi" yapar ve müşteriyi bilgilendirir (yönetici oturumu proxy.ts ile doğrulanır). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const { regenerate } = (await req.json().catch(() => ({}))) as { regenerate?: boolean };

    const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (order.shippingType !== "STANDART_KARGO") {
      return NextResponse.json({ error: "Mağaza teslimi siparişleri için kargo gerekmez." }, { status: 400 });
    }
    if (!SHIPPABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: "Barkod yalnızca ödemesi onaylanmış (hazırlanıyor) siparişler için oluşturulabilir." }, { status: 409 });
    }
    if (order.labelCreated && !regenerate) {
      return NextResponse.json({ error: "Bu sipariş için barkod zaten oluşturulmuş." }, { status: 409 });
    }

    // Önce koşullu sahiplenme (lib/shipping-claim.ts): labelCreated okunan değerden tersine çevrilir; çift tıklamada / iki sekmede yalnızca bir istek kazanır.
    // Durum yazımı da koşulludur: gönderi açılırken iptal/iade edilen sipariş SHIPPED yapılmaz.
    const stillShippable = { id, status: { in: SHIPPABLE_STATUSES } };
    const result = await createShippingOnce({
      claim: async () => (await prisma.order.updateMany({ where: { ...stillShippable, labelCreated: order.labelCreated }, data: { labelCreated: !order.labelCreated } })).count > 0,
      // Sipariş onayında otomatik açılan taslak gönderi varsa o kullanılır, yoksa yeni gönderi oluşturulur
      open: () => (order.kargonomiShipmentId && !regenerate ? refreshOrderShipment(id) : createShipmentForOrder(id, { regenerate: Boolean(regenerate) })),
      finish: async (s) =>
        (
          await prisma.order.updateMany({
            where: stillShippable,
            data: { status: "SHIPPED", labelCreated: true, barcodeUrl: s.barcodeUrl || `/api/admin/kargonomi/barcode?orderId=${id}`, shippingProviderId: 4, shippingProviderName: "Aras Kargo" },
          })
        ).count > 0,
      release: () => prisma.order.updateMany({ where: { id }, data: { labelCreated: order.labelCreated } }),
    });
    if (result.outcome === "CLAIM_LOST") {
      return NextResponse.json({ error: "Bu sipariş için barkod işlemi zaten yapılıyor/yapılmış veya sipariş durumu değişti. Sayfayı yenileyin." }, { status: 409 });
    }
    if (result.outcome === "STATUS_CHANGED") {
      return NextResponse.json({ error: "Gönderi açılırken sipariş durumu değişti (iptal/iade edilmiş olabilir); sipariş kargoya verildi yapılmadı. Açılan gönderiyi Kargonomi panelinden iptal edin ve sayfayı yenileyin." }, { status: 409 });
    }
    const shipped = result.shipped;
    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });

    const tracking = shipped.shippingTrackingCode || shipped.shippingBarcode;
    const carrier = shipped.shippingProviderName || "Aras Kargo";
    if (!regenerate && tracking) {
      await notifyCustomer(
        { userId: order.userId },
        {
          title: `Siparişiniz ${carrier}'ya Verildi`,
          message: `#${id.slice(0, 8)} • Takip No: ${tracking}`,
          type: "ORDER",
          link: `/kargo-takip?code=${encodeURIComponent(tracking)}`,
        }
      );
      await sendShippedEmail({ to: cleanGuestEmail(order.user.email), name: order.user.name, orderId: id, carrier, trackingNumber: tracking }).catch((e) =>
        console.warn("Kargo e-postası gönderilemedi:", (e as Error).message)
      );
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    const status = error instanceof KargonomiError && error.status >= 400 && error.status < 600 ? error.status : 502;
    console.error("[admin/create-shipping]", (error as Error).message);
    const message = error instanceof KargonomiError ? error.message : "Kargo kaydı oluşturulamadı. Lütfen tekrar deneyin.";
    return NextResponse.json({ error: message }, { status });
  }
}
