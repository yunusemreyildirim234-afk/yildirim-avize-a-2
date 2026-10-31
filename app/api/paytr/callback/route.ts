import { prisma } from "@/lib/db";
import { releaseCoupon } from "@/lib/coupons";
import { finalizeOrder } from "@/lib/orders";
import { fromMerchantOid, verifyPaytrCallback } from "@/lib/paytr";

const ok = () => new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });

// PayTR "Bildirim URL" — PayTR panelinde https://<alan-adiniz>/api/paytr/callback olarak tanımlanmalıdır.
// PayTR'nin URL kontrol botu GET ile erişir; 200 "OK" ile karşılanır.
export async function GET() {
  return ok();
}

export async function POST(req: Request) {
  // PayTR application/x-www-form-urlencoded gönderir
  const p = Object.fromEntries(new URLSearchParams(await req.text().catch(() => "")));

  // Test isteği / eksik parametre: hata vermeden "OK"
  if (!p.merchant_oid || !p.status || !p.total_amount || !p.hash) return ok();

  if (!verifyPaytrCallback({ merchant_oid: p.merchant_oid, status: p.status, total_amount: p.total_amount, hash: p.hash })) {
    return new Response("PAYTR notification failed: bad hash", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const orderId = fromMerchantOid(p.merchant_oid);
  if (p.status === "success") {
    // Ödendi → AWAITING_PAYMENT/PENDING_NEW siparişi PENDING (hazırlanıyor) olur; tekrar bildirimde işlem yapılmaz
    await finalizeOrder(orderId);
  } else {
    const failed = await prisma.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT" }, data: { status: "PAYMENT_FAILED" } });
    if (failed.count > 0) {
      const o = await prisma.order.findUnique({ where: { id: orderId }, select: { couponCode: true } });
      await releaseCoupon(o?.couponCode).catch(() => {});
    }
  }

  return ok();
}
