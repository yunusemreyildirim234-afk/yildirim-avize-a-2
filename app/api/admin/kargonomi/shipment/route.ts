import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { KargonomiError, createShipmentForOrder, refreshOrderShipment } from "@/lib/kargonomi";

function fail(error: unknown) {
  const status = error instanceof KargonomiError ? error.status : 500;
  return NextResponse.json({ error: (error as Error).message }, { status: status >= 400 && status < 600 ? status : 502 });
}

// Gönderi oluştur
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId zorunlu" }, { status: 400 });
    return NextResponse.json({ success: true, order: await createShipmentForOrder(orderId) });
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
    return NextResponse.json({ success: true, order: await refreshOrderShipment(orderId) });
  } catch (error) {
    return fail(error);
  }
}
