import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { reserveCoupon } from "@/lib/coupons";
import { verifySession } from "@/lib/session";
import { UNDO_TTL_MS } from "@/lib/admin-undo";
import { reserveCouponForUndo } from "@/lib/order-undo";

class Refusal extends Error {}

interface OrderUndo extends Record<string, unknown> {
  kind: string;
  iat: number;
  orderId: string;
  from: string;
  to: string;
  restoredStock: boolean;
  coupon: string | null;
}

// Sipariş durumu değişikliğini geri alır. Her şey tek transaction'da: durum (karşılaştır-ve-ata), stok (yeterliyse düş), kupon (geçerliyse yeniden say).
// Biri başarısız olursa hiçbir şey değişmez ve neden gösterilir. Müşteriye e-posta/bildirim GÖNDERİLMEZ.
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const t = typeof body.undoToken === "string" ? await verifySession<OrderUndo>(body.undoToken) : null;
  if (!t || t.kind !== "order-undo" || typeof t.orderId !== "string" || typeof t.from !== "string" || typeof t.to !== "string") {
    return NextResponse.json({ error: "Geri alma kaydı geçersiz veya değiştirilmiş." }, { status: 400 });
  }
  if (Date.now() - Number(t.iat) > UNDO_TTL_MS) return NextResponse.json({ error: "Geri alma süresi (30 dk) doldu." }, { status: 410 });

  try {
    let couponWarning: string | undefined;
    await prisma.$transaction(async (tx) => {
      // Durum hâlâ değiştirdiğimiz değerdeyse atomik olarak eskisine döner
      const claimed = await tx.order.updateMany({ where: { id: t.orderId, status: t.to }, data: { status: t.from } });
      if (claimed.count === 0) throw new Refusal("Sipariş durumu bu arada değiştirilmiş; geri alınamadı.");

      if (t.restoredStock) {
        // Bayrakla idempotent: zaten düşülmüşse tekrar düşülmez
        const flag = await tx.order.updateMany({ where: { id: t.orderId, stockDeducted: false }, data: { stockDeducted: true } });
        if (flag.count === 1) {
          const items = await tx.orderItem.findMany({
            where: { orderId: t.orderId },
            select: { variationId: true, quantity: true, variation: { select: { variationValue: true, product: { select: { title: true } } } } },
          });
          for (const i of items) {
            const n = await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${i.quantity} WHERE "id" = ${i.variationId} AND "stock" >= ${i.quantity}`;
            if (n === 0) throw new Refusal(`Stok yetersiz: "${i.variation.product.title}" / ${i.variation.variationValue} için ${i.quantity} adet stok yok. Geri alınamadı.`);
          }
        }
      }

      // İptalde iade edilen kupon hakkı yeniden ayrılır (atomik, usedCount < maxUses). Durum geri alma yukarıda koşullu güncellemeyle
      // yalnızca bir kez kazanıldığı için çift sayım olmaz. Limit bu arada dolduysa durum yine geri alınır, uyarı gösterilir.
      couponWarning = (await reserveCouponForUndo(t.coupon, (code) => reserveCoupon(tx, code))).warning;
    }, { maxWait: 5000, timeout: 10000 });
    return NextResponse.json({ success: true, status: t.from, ...(couponWarning ? { couponWarning } : {}) });
  } catch (e) {
    if (e instanceof Refusal) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[order-undo]", (e as Error).message);
    return NextResponse.json({ error: "Geri alınamadı." }, { status: 500 });
  }
}
