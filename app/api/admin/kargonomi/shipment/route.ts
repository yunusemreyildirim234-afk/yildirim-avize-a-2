import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { refreshWithAutoShip } from "@/lib/mark-shipped";
import { KargonomiError, createShipmentForOrder } from "@/lib/kargonomi";
import { creationFailWarning } from "@/lib/creation-fail";

function fail(error: unknown) {
  const status = error instanceof KargonomiError ? error.status : 500;
  console.error("[admin/kargonomi/shipment]", (error as Error).message);
  // Kargonomi'nin bildirdiği (adres/gönderi) hataları yöneticiye aktarılır; beklenmeyen hatada genel mesaj
  const message = error instanceof KargonomiError ? error.message : "Gönderi işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
  return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Gönderi oluştur
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId zorunlu" }, { status: 400 });
    // Kargonomi çağrılmadan önce koşullu sahiplenme (A5): aynı anda ikinci istek (iki sekme / ödeme bildirimi) 409 alır, ikinci gönderi açılmaz.
    const claim = await prisma.order.updateMany({ where: { id: orderId, kargonomiShipmentId: null, labelCreated: false }, data: { labelCreated: true } });
    if (claim.count === 0) {
      const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { kargonomiShipmentId: true } });
      if (!existing) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
      return NextResponse.json({ error: existing.kargonomiShipmentId ? "Bu sipariş için gönderi zaten oluşturulmuş." : "Bu sipariş için gönderi zaten oluşturuluyor." }, { status: 409 });
    }
    try {
      const created = await createShipmentForOrder(orderId);
      return NextResponse.json({ success: true, order: created, warning: creationFailWarning(created.creationFailReason) });
    } catch (error) {
      // Gönderi açılamadı: sahiplenme bırakılır (yeniden denenebilsin)
      await prisma.order.updateMany({ where: { id: orderId, kargonomiShipmentId: null }, data: { labelCreated: false } }).catch(() => {});
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}

// Kargo durumunu Kargonomi'den yenile
export async function PATCH(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId zorunlu" }, { status: 400 });
    const r = await refreshWithAutoShip(orderId);
    return NextResponse.json({ success: true, order: r.order, warning: creationFailWarning(r.creationFailReason) });
  } catch (error) {
    return fail(error);
  }
}
