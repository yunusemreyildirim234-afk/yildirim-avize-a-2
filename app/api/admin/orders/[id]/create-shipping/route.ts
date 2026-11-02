import { cleanGuestEmail } from "@/lib/guest-email";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KargonomiError, createShipmentForOrder, refreshOrderShipment } from "@/lib/kargonomi";
import { sendShippedEmail } from "@/lib/email";
import { notifyCustomer } from "@/lib/notifications";

/** Aras Kargo barkodunu Kargonomi'de oluşturur, siparişi "kargoya verildi" yapar ve müşteriyi bilgilendirir (yönetici oturumu proxy.ts ile doğrulanır). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { regenerate } = (await req.json().catch(() => ({}))) as { regenerate?: boolean };

    const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (order.shippingType !== "STANDART_KARGO") {
      return NextResponse.json({ error: "Mağaza teslimi siparişleri için kargo gerekmez." }, { status: 400 });
    }
    if (!["PENDING", "SHIPPED"].includes(order.status)) {
      return NextResponse.json({ error: "Barkod yalnızca ödemesi onaylanmış (hazırlanıyor) siparişler için oluşturulabilir." }, { status: 409 });
    }
    if (order.labelCreated && !regenerate) {
      return NextResponse.json({ error: "Bu sipariş için barkod zaten oluşturulmuş." }, { status: 409 });
    }

    // Sipariş onayında otomatik açılan taslak gönderi varsa o kullanılır, yoksa yeni gönderi oluşturulur
    const shipped =
      order.kargonomiShipmentId && !regenerate ? await refreshOrderShipment(id) : await createShipmentForOrder(id, { regenerate: Boolean(regenerate) });
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "SHIPPED",
        labelCreated: true,
        barcodeUrl: shipped.barcodeUrl || `/api/admin/kargonomi/barcode?orderId=${id}`,
        shippingProviderId: 4,
        shippingProviderName: "Aras Kargo",
      },
    });

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
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
