import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { kargonomiRaw } from "@/lib/kargonomi";

const pdfResponse = (bytes: Uint8Array<ArrayBuffer>) => new NextResponse(bytes, { headers: { "Content-Type": "application/pdf" } });

// Kargonomi barkod çıktısını (PDF veya Base64 PDF/JSON) yazdırılabilir PDF olarak iletir
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId");
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
  if (!order?.kargonomiShipmentId) {
    return NextResponse.json({ error: "Siparişin Kargonomi gönderisi yok." }, { status: 404 });
  }

  const upstream = await kargonomiRaw(`/shipments/${order.kargonomiShipmentId}/barcode?format=pdf`, {
    headers: { Accept: "application/pdf, application/json" },
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: `Barkod alınamadı (${upstream.status})` }, { status: 502 });
  }

  const type = upstream.headers.get("content-type") || "";
  if (!type.includes("json")) {
    return new NextResponse(upstream.body, { headers: { "Content-Type": type || "application/pdf" } });
  }

  // JSON yanıt: Base64 PDF veya hazır bağlantı
  const json = await upstream.json().catch(() => null);
  const d = json?.data ?? json;
  const link: string | undefined = d?.barcode_url ?? d?.label_url ?? d?.url;
  if (link) return NextResponse.redirect(link);
  const b64: string | undefined = [d?.pdf, d?.barcode, d?.content, d?.data, typeof d === "string" ? d : undefined].find(
    (v) => typeof v === "string" && v.length > 100
  );
  if (!b64) return NextResponse.json({ error: "Barkod verisi çözümlenemedi." }, { status: 502 });
  return pdfResponse(Uint8Array.from(Buffer.from(b64.replace(/^data:application\/pdf;base64,/, ""), "base64")));
}
