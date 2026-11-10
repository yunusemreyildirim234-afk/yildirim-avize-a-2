import { cleanGuestEmail } from "@/lib/guest-email";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendRequestDecisionEmail } from "@/lib/email";
import { releaseCoupon } from "@/lib/coupons";
import { RequestRefusal, decideRequestInTx } from "@/lib/order-request";
import type { StatusChangeTx } from "@/lib/order-undo";

// Yönetici iptal/iade talebini onaylar veya reddeder (proxy yalnızca yöneticiye açar)
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const approve = body.decision === "APPROVE";
  const reject = body.decision === "REJECT";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!orderId || (!approve && !reject)) return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !order.cancelReturnType) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  if (order.cancelReturnStatus !== "PENDING") return NextResponse.json({ error: "Talep zaten sonuçlandırılmış." }, { status: 409 });

  // Karar + sipariş durumu + stok + kupon TEK transaction'da (lib/order-request.ts): koşullu sahiplenme çift tıklamada çift iadeyi ve çift e-postayı engeller;
  // onay anında güncel durum yeniden okunur (kargoya verilmiş/teslim edilmiş sipariş iptal edilmez). Reddedilirse hiçbir şey yazılmaz.
  let result;
  try {
    result = await prisma.$transaction(
      (tx) => decideRequestInTx(tx as unknown as StatusChangeTx, { orderId, type: order.cancelReturnType as string, approve, note: note || null }, (code) => releaseCoupon(code, tx)),
      { maxWait: 5000, timeout: 10000 },
    );
  } catch (e) {
    if (e instanceof RequestRefusal) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[admin/order-request]", (e as Error).message);
    return NextResponse.json({ error: "Talep sonuçlandırılamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
  if (result.outcome === "ALREADY_DECIDED") return NextResponse.json({ error: "Talep zaten sonuçlandırılmış." }, { status: 409 });

  // E-posta transaction dışında ve yalnızca kararı kazanan istekte gönderilir
  const emailed = await sendRequestDecisionEmail({
    to: cleanGuestEmail(order.user.email),
    name: order.user.name,
    type: order.cancelReturnType,
    approved: approve,
    orderId,
    note,
  }).catch(() => false);

  return NextResponse.json({ success: true, emailed });
}

export const POST = withStorefrontRevalidate(POSTHandler);
