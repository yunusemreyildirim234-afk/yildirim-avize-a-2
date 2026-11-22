import { adminGuard } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KargonomiError, confirmShippingPrice, createShipmentForOrder, getPriceComparison, refreshOrderShipment } from "@/lib/kargonomi";
import { isSelectableProviderId } from "@/lib/carrier-quotes";
import { PROVIDER_LABEL, openShipmentWithProvider } from "@/lib/shipping-confirm";
import { decideRegenerate } from "@/lib/regenerate-guard";
import { KARGONOMI_TIMEOUT_MESSAGE, SHIPPABLE_STATUSES, createShippingOnce, isTimeoutError } from "@/lib/shipping-claim";

export const maxDuration = 60;

/** Seçilen firmayla (Aras/Hepsijet) Kargonomi gönderisini onaylayıp barkodu oluşturur. Sipariş durumu "Hazırlanıyor" kalır; müşteriye bildirim gitmez (kargoya verildi geçişinde order-status gönderir). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const { regenerate, providerId } = (await req.json().catch(() => ({}))) as { regenerate?: boolean; providerId?: unknown };
    if (!isSelectableProviderId(providerId)) return NextResponse.json({ error: "Geçersiz kargo firması (yalnız Aras Kargo veya Hepsijet)." }, { status: 400 });

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

    // Yeniden üretme: bağlı gönderi önce yenilenir; aktif/onaylıysa (taslak ya da iptal değilse) hiçbir şey açılmaz
    const guard = await decideRegenerate(order, Boolean(regenerate), () => refreshOrderShipment(id));
    if (guard.action === "blocked") return NextResponse.json({ error: guard.message }, { status: 409 });

    // Önce koşullu sahiplenme (lib/shipping-claim.ts): labelCreated okunan değerden tersine çevrilir; çift tıklamada / iki sekmede yalnızca bir istek kazanır.
    // Barkod yazımı da koşulludur: gönderi açılırken iptal/iade edilen sipariş için STATUS_CHANGED döner. Sipariş durumuna dokunulmaz.
    const stillShippable = { id, status: { in: SHIPPABLE_STATUSES } };
    const result = await createShippingOnce({
      claim: async () => (await prisma.order.updateMany({ where: { ...stillShippable, labelCreated: order.labelCreated }, data: { labelCreated: !order.labelCreated } })).count > 0,
      // Sipariş onayında otomatik açılan taslak varsa o kullanılır; firma barkoddan ÖNCE sunucuda doğrulanıp onaylanır
      open: () =>
        openShipmentWithProvider(
          { hasShipment: Boolean(order.kargonomiShipmentId), regenerate: Boolean(regenerate), providerId },
          {
            createDraft: () => createShipmentForOrder(id, { regenerate: Boolean(regenerate) }),
            refresh: () => refreshOrderShipment(id),
            getPriceComparison,
            confirmShippingPrice,
          }
        ),
      finish: async ({ shipment: s, confirmed }) => {
        // Firma: Kargonomi'den gelen; yoksa bu çağrıda onaylanan seçim; ikisi de yoksa dokunulmaz
        const provider = s.shippingProviderId ? {} : confirmed ? { shippingProviderId: confirmed, shippingProviderName: PROVIDER_LABEL[confirmed] } : {};
        return (
          (
            await prisma.order.updateMany({
              where: stillShippable,
              data: { labelCreated: true, barcodeUrl: s.barcodeUrl || `/api/admin/kargonomi/barcode?orderId=${id}`, ...provider },
            })
          ).count > 0
        );
      },
      release: () => prisma.order.updateMany({ where: { id }, data: { labelCreated: order.labelCreated } }),
    });
    if (result.outcome === "CLAIM_LOST") {
      return NextResponse.json({ error: "Bu sipariş için barkod işlemi zaten yapılıyor/yapılmış veya sipariş durumu değişti. Sayfayı yenileyin." }, { status: 409 });
    }
    if (result.outcome === "STATUS_CHANGED") {
      return NextResponse.json({ error: "Gönderi açılırken sipariş durumu değişti (iptal/iade edilmiş olabilir); barkod kaydedilmedi. Açılan gönderiyi Kargonomi panelinden iptal edin ve sayfayı yenileyin." }, { status: 409 });
    }
    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    // Zaman aşımı: istek Kargonomi'ye ulaşmış ve gönderi açılmış olabilir. Sahiplenme bırakılmıştır (yeniden denenebilir) ama yönetici önce paneli kontrol etmelidir.
    if (isTimeoutError(error)) {
      console.error("[admin/create-shipping] Kargonomi zaman aşımı");
      return NextResponse.json({ error: KARGONOMI_TIMEOUT_MESSAGE }, { status: 504 });
    }
    const status = error instanceof KargonomiError && error.status >= 400 && error.status < 600 ? error.status : 502;
    console.error("[admin/create-shipping]", (error as Error).message);
    const message = error instanceof KargonomiError ? error.message : "Kargo kaydı oluşturulamadı. Lütfen tekrar deneyin.";
    return NextResponse.json({ error: message }, { status });
  }
}
