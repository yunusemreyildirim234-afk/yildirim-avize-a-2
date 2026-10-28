import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { kargonomiRaw } from "@/lib/kargonomi";

// Kargonomi barkod çıktısını (PDF/etiket) olduğu gibi iletir
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId");
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
  if (!order?.kargonomiShipmentId) {
    return NextResponse.json({ error: "Siparişin Kargonomi gönderisi yok." }, { status: 404 });
  }

  const upstream = await kargonomiRaw(`/shipments/${order.kargonomiShipmentId}/barcode`, {
    headers: { Accept: "application/pdf, application/json" },
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: `Barkod alınamadı (${upstream.status})` }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/pdf" },
  });
}
