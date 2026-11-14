import { cookies } from "next/headers";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { REVIEW_STATUS } from "@/lib/reviews";

// Onaylı yorum fotoğrafları herkese açıktır; onaysız olanlar yalnızca yöneticiye ve yorum sahibine görünür
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(req, "review-image", 300, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { id } = await params;
  const image = await prisma.reviewImage.findUnique({
    where: { reviewId: id },
    include: { review: { select: { status: true, userId: true } } },
  });
  if (!image) return new Response("Bulunamadı", { status: 404 });

  const approved = image.review.status === REVIEW_STATUS.APPROVED;
  if (!approved) {
    const isAdmin = Boolean(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value));
    const uid = isAdmin ? null : await getSessionUserId();
    if (!isAdmin && uid !== image.review.userId) return new Response("Yetkisiz", { status: 403 });
  }
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": approved ? "public, max-age=3600, s-maxage=86400" : "private, no-store",
    },
  });
}
