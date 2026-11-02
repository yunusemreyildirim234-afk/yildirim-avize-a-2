import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifySession } from "@/lib/session";
import { REVIEW_STATUS } from "@/lib/reviews";

// Onaylı yorum fotoğrafları herkese açıktır; onaysız olanlar yalnızca yöneticiye ve yorum sahibine görünür
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await prisma.reviewImage.findUnique({
    where: { reviewId: id },
    include: { review: { select: { status: true, userId: true } } },
  });
  if (!image) return new Response("Bulunamadı", { status: 404 });

  const approved = image.review.status === REVIEW_STATUS.APPROVED;
  if (!approved) {
    const isAdmin = Boolean(await verifySession((await cookies()).get(ADMIN_COOKIE)?.value));
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
