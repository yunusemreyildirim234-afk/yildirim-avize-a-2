import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { KargonomiError, getPriceComparison } from "@/lib/kargonomi";
import { parseQuotes, recommendProvider, selectableQuotes } from "@/lib/carrier-quotes";
import { isTimeoutError } from "@/lib/shipping-claim";

/** Barkod öncesi Aras / Hepsijet anlık fiyatları ve önerilen firma (salt okuma). */
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "orderId zorunlu" }, { status: 400 });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { kargonomiShipmentId: true, kargonomiStatus: true, buyerStateId: true, shippingProviderId: true, shippingType: true },
    });
    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (order.shippingType !== "STANDART_KARGO") return NextResponse.json({ error: "Mağaza teslimi siparişleri için kargo gerekmez." }, { status: 400 });
    if (!order.kargonomiShipmentId) {
      return NextResponse.json({ error: "Bu sipariş için henüz Kargonomi gönderi taslağı yok. Taslak ödeme onayından sonra açılır; Kargonomi panelinden kontrol edin." }, { status: 409 });
    }
    // Gönderi panelde zaten onaylanmışsa fiyat seçimi yoktur; barkod bilgisi yalnız çekilir
    if (order.kargonomiStatus && order.kargonomiStatus !== "draft") {
      return NextResponse.json({ confirmed: true, providerId: order.shippingProviderId, quotes: [], recommended: null, reason: null });
    }
    const quotes = selectableQuotes(parseQuotes(await getPriceComparison(order.kargonomiShipmentId)));
    const rec = recommendProvider(order.buyerStateId, quotes);
    return NextResponse.json({ confirmed: false, quotes, recommended: rec?.providerId ?? null, reason: rec?.reason ?? null });
  } catch (error) {
    if (isTimeoutError(error)) return NextResponse.json({ error: "Kargonomi yanıt vermedi, fiyatlar alınamadı. Lütfen tekrar deneyin." }, { status: 504 });
    console.error("[admin/kargonomi/quotes]", (error as Error).message);
    const status = error instanceof KargonomiError && error.status >= 400 && error.status < 600 ? error.status : 502;
    return NextResponse.json({ error: error instanceof KargonomiError ? `Fiyatlar alınamadı: ${error.message}` : "Fiyatlar alınamadı. Lütfen tekrar deneyin." }, { status });
  }
}
