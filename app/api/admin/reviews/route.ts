import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { notifyCustomer } from "@/lib/notifications";
import { REVIEW_STATUS } from "@/lib/reviews";
import { productPath } from "@/lib/product-url";

import { rateLimit, tooMany } from "@/lib/rate-limit";
import type { AdminReview } from "@/components/AdminReviews";

// Yorum listesi (en çok 300): panel sayfasıyla değil, "Müşteri Yorumları" bölümü açılınca istenir. Onay bekleyenler üstte, kendi içinde en yeni önce.
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-reviews", 30, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const rows = await prisma.review.findMany({
    include: { user: { select: { name: true, email: true } }, product: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  rows.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime());
  const list: AdminReview[] = rows.map((r) => ({
    id: r.id,
    author: r.user.name,
    email: r.user.email,
    productTitle: r.product.title,
    rating: r.rating,
    comment: r.comment,
    imageUrl: r.imageUrl,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json(list);
}

// Yorum onay/ret ve silme (yalnızca yönetici — proxy.ts /api/admin altını korur)
async function PATCHHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
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
        link: `${productPath(review.product)}#yorumlar`,
      }
    ).catch(() => {});
  }
  return NextResponse.json({ success: true });
}

async function DELETEHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { reviewId } = await req.json().catch(() => ({}));
  if (typeof reviewId !== "string") return NextResponse.json({ error: "reviewId zorunlu" }, { status: 400 });
  await prisma.review.delete({ where: { id: reviewId } }).catch(() => null);
  return NextResponse.json({ success: true });
}

export const PATCH = withStorefrontRevalidate(PATCHHandler);
export const DELETE = withStorefrontRevalidate(DELETEHandler);
