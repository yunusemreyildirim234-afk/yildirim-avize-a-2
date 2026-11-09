import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { reserveCoupon } from "@/lib/coupons";
import { verifySession } from "@/lib/session";
import { UNDO_TTL_MS } from "@/lib/admin-undo";
import { UndoRefusal, applyUndoInTx, type UndoTx } from "@/lib/order-undo";

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
async function POSTHandler(req: Request) {
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
      // Kupon limiti bu arada dolduysa durum yine geri alınır, uyarı gösterilir (lib/order-undo.ts applyUndoInTx)
      couponWarning = (await applyUndoInTx(tx as unknown as UndoTx, t, {
        deduct: async (variationId, quantity) => (await tx.$executeRaw`UPDATE "ProductVariation" SET "stock" = "stock" - ${quantity} WHERE "id" = ${variationId} AND "stock" >= ${quantity}`) > 0,
        reserve: (code) => reserveCoupon(tx, code),
      })).warning;
    }, { maxWait: 5000, timeout: 10000 });
    return NextResponse.json({ success: true, status: t.from, ...(couponWarning ? { couponWarning } : {}) });
  } catch (e) {
    if (e instanceof UndoRefusal) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[order-undo]", (e as Error).message);
    return NextResponse.json({ error: "Geri alınamadı." }, { status: 500 });
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);
