import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDeliveredStatus, markDelivered } from "@/lib/shipment-sync";

// Herkese açık uç (proxy.ts korumasının dışında): güvenlik tamamen X-Webhook-Signature (HMAC-SHA256) doğrulamasına dayanır.
// Secret tanımlı değilse veya imza yanlışsa 401 döner (fail closed).

function validSignature(raw: string, header: string, secret: string): boolean {
  const given = header.trim().replace(/^sha256=/i, "");
  if (!given) return false;
  const hex = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const b64 = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const g = Buffer.from(given);
  return [hex, b64].some((expected) => {
    const e = Buffer.from(expected);
    return e.length === g.length && timingSafeEqual(e, g);
  });
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function POST(req: Request) {
  const secret = process.env.KARGONOMI_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret || !validSignature(raw, req.headers.get("x-webhook-signature") ?? "", secret)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const payload = asObj(JSON.parse(raw));
    const event = str(payload.event) ?? str(payload.type) ?? str(payload.event_type);
    if (event !== "shipment.updated") return NextResponse.json({ ok: true, ignored: true });

    // Payload biçimi doğrulanamadığı için savunmacı okunur: {data:{shipment:{...}}}, {data:{...}} veya düz {...}
    const data = asObj(payload.data ?? payload);
    const s = asObj(data.shipment ?? data);
    const id = Number(s.id ?? data.shipment_id);
    const tracking = str(s.shipping_webservice_tracking_code) ?? str(s.tracking_code);
    const firstPackage = Array.isArray(s.shipment_packages) ? asObj(s.shipment_packages[0]) : {};
    const barcode = str(s.shipping_webservice_barcode) ?? str(firstPackage.barcode);
    const status = str(s.status);
    const label = str(s.status_label);

    if (!isDeliveredStatus(status, label)) return NextResponse.json({ ok: true, ignored: true });

    const or: Array<Record<string, unknown>> = [];
    if (Number.isFinite(id) && id > 0) or.push({ kargonomiShipmentId: id });
    if (tracking) or.push({ shippingTrackingCode: tracking });
    if (barcode) or.push({ shippingBarcode: barcode });
    if (or.length === 0) return NextResponse.json({ ok: true, ignored: true });

    const order = await prisma.order.findFirst({ where: { OR: or }, select: { id: true } });
    if (!order) return NextResponse.json({ ok: true, ignored: true });

    await markDelivered(order.id, { ...(status ? { kargonomiStatus: status } : {}), ...(label ? { kargonomiStatusLabel: label } : {}) });
  } catch (e) {
    console.error("[kargonomi-webhook] işlenemedi:", (e as Error).message);
  }
  // Kargonomi'nin gereksiz yeniden denemesini önlemek için imzası geçerli her istek 200 alır
  return NextResponse.json({ ok: true });
}
