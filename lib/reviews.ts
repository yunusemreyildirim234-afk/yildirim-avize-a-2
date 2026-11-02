import { prisma } from "@/lib/db";

/** Yorum hakkı veren sipariş durumları (PENDING = ödemesi alınmış/hazırlanan; havale onayı bekleyen PENDING_NEW dahil değildir). */
export const REVIEWABLE_STATUSES = ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"];

export const REVIEW_STATUS = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;

/** "Ayşe Yılmaz" → "A. Y." */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => p[0]!.toLocaleUpperCase("tr-TR") + ".").join(" ") || "M.";
}

export type ReviewEligibility =
  | { state: "can"; orderId: string }
  | { state: "no-purchase" }
  | { state: "reviewed"; review: { rating: number; comment: string; status: string; imageUrl: string | null } };

/** Kullanıcı (userId veya aynı e-postalı hesap) ürünü satın almış ve daha önce yorum yapmamış mı? */
export async function reviewEligibility(userId: string, productId: string): Promise<ReviewEligibility> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return { state: "no-purchase" };

  const existing = await prisma.review.findFirst({
    where: { productId, user: { OR: [{ id: user.id }, { email: { equals: user.email, mode: "insensitive" } }] } },
    select: { rating: true, comment: true, status: true, imageUrl: true },
  });
  // Reddedilen yorum yeniden yazılabilir
  if (existing && existing.status !== REVIEW_STATUS.REJECTED) return { state: "reviewed", review: existing };

  const purchased = await prisma.orderItem.findFirst({
    where: {
      variation: { productId },
      order: {
        status: { in: REVIEWABLE_STATUSES },
        OR: [{ userId: user.id }, { user: { email: { equals: user.email, mode: "insensitive" } } }],
      },
    },
    select: { orderId: true },
    orderBy: { order: { createdAt: "desc" } },
  });
  return purchased ? { state: "can", orderId: purchased.orderId } : { state: "no-purchase" };
}
