import { prisma } from "@/lib/db";

/** Yorum hakkı veren sipariş durumları (ödenmiş / hazırlanan / kargolanan / teslim edilen). */
export const REVIEWABLE_STATUSES = ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"];

export type ReviewEligibility =
  | { state: "can" }
  | { state: "no-purchase" }
  | { state: "reviewed"; review: { rating: number; comment: string } };

/** Kullanıcı (userId veya aynı e-postalı hesap) ürünü satın almış ve daha önce yorum yapmamış mı? */
export async function reviewEligibility(userId: string, productId: string): Promise<ReviewEligibility> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return { state: "no-purchase" };

  const existing = await prisma.review.findFirst({
    where: { productId, user: { OR: [{ id: user.id }, { email: { equals: user.email, mode: "insensitive" } }] } },
    select: { rating: true, comment: true },
  });
  if (existing) return { state: "reviewed", review: existing };

  const purchased = await prisma.orderItem.findFirst({
    where: {
      variation: { productId },
      order: {
        status: { in: REVIEWABLE_STATUSES },
        OR: [{ userId: user.id }, { user: { email: { equals: user.email, mode: "insensitive" } } }],
      },
    },
    select: { id: true },
  });
  return purchased ? { state: "can" } : { state: "no-purchase" };
}
