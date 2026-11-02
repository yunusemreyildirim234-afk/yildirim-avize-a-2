import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { REVIEW_STATUS } from "@/lib/reviews";

// Yorum onay/ret ve silme (yalnızca yönetici — proxy.ts /api/admin altını korur)
export async function PATCH(req: Request) {
  const { reviewId, status } = await req.json().catch(() => ({}));
  if (typeof reviewId !== "string" || (status !== REVIEW_STATUS.APPROVED && status !== REVIEW_STATUS.REJECTED)) {
    return NextResponse.json({ error: "reviewId ve geçerli bir durum (APPROVED | REJECTED) zorunlu" }, { status: 400 });
  }
  const review = await prisma.review
    .update({ where: { id: reviewId }, data: { status }, include: { product: { select: { id: true, title: true } } } })
    .catch(() => null);
  if (!review) return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 });

  if (status === REVIEW_STATUS.APPROVED) {
    await notifyCustomer(
      { userId: review.userId },
      {
        title: "Yorumunuz yayınlandı",
        message: `${review.product.title} için yorumunuz yayınlandı. Teşekkür ederiz!`,
        type: "SYSTEM",
        link: `/urun/${review.product.id}#yorumlar`,
      }
    ).catch(() => {});
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { reviewId } = await req.json().catch(() => ({}));
  if (typeof reviewId !== "string") return NextResponse.json({ error: "reviewId zorunlu" }, { status: 400 });
  await prisma.review.delete({ where: { id: reviewId } }).catch(() => null);
  return NextResponse.json({ success: true });
}
