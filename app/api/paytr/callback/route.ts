import { prisma } from "@/lib/db";
import { finalizeOrder } from "@/lib/orders";
import { fromMerchantOid, verifyPaytrCallback } from "@/lib/paytr";

// PayTR "Bildirim URL" — PayTR panelinde https://<alan-adiniz>/api/paytr/callback olarak tanımlanmalıdır.
export async function POST(req: Request) {
  const form = await req.formData();
  const p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  if (!verifyPaytrCallback({ merchant_oid: p.merchant_oid, status: p.status, total_amount: p.total_amount, hash: p.hash })) {
    return new Response("PAYTR notification failed: bad hash", { status: 400 });
  }

  const orderId = fromMerchantOid(p.merchant_oid);
  if (p.status === "success") {
    await finalizeOrder(orderId);
  } else {
    await prisma.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT" }, data: { status: "PAYMENT_FAILED" } });
  }

  // PayTR yalnızca "OK" metnini bekler
  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}
