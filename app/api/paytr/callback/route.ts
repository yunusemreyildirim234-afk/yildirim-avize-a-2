import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { releaseCoupon } from "@/lib/coupons";
import { finalizeOrder } from "@/lib/orders";
import { fromMerchantOid } from "@/lib/paytr";

const ok = () => new Response("OK", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });

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

  const merchantKey = (process.env.PAYTR_MERCHANT_KEY || process.env.MERCHANT_KEY || "").trim();
  const merchantSalt = (process.env.PAYTR_MERCHANT_SALT || process.env.MERCHANT_SALT || "").trim();

  // Callback hash: HMAC-SHA256(merchant_oid + salt + status + total_amount, key) — salt yalnızca bir kez eklenir
  const hashStr = `${p.merchant_oid}${merchantSalt}${p.status}${p.total_amount}`;
  const token = createHmac("sha256", merchantKey).update(hashStr).digest("base64");
  const a = Buffer.from(token);
  const b = Buffer.from(p.hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.log("PayTR Gelen Hash:", p.hash);
    console.log("Hesaplanan Hash:", token);
    console.log("Kullanılan Salt Dolu mu?:", !!merchantSalt, "Key Dolu mu?:", !!merchantKey);
    return new Response("PAYTR notification failed: bad hash", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const orderId = fromMerchantOid(p.merchant_oid);

  // İdempotency: sipariş zaten işlenmişse (PENDING/SHIPPED/DELIVERED/PAYMENT_FAILED/CANCELLED vb.) stok ve kupon işlemleri tekrarlanmaz
  const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!current || !["AWAITING_PAYMENT", "PENDING_NEW"].includes(current.status)) return ok();
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
