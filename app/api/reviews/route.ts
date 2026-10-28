import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { USER_COOKIE, verifySession } from "@/lib/session";

// Yorum yazmak için müşteri girişi gerekir; ürünü satın alanlar "doğrulanmış alıcı" olarak işaretlenir.
export async function POST(req: Request) {
  const session = await verifySession<{ uid: string }>((await cookies()).get(USER_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Yorum yazmak için giriş yapmalısınız." }, { status: 401 });
  }

  const { productId, rating, comment } = await req.json().catch(() => ({}));
  const stars = Number(rating);
  const text = typeof comment === "string" ? comment.trim() : "";

  if (typeof productId !== "string" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Geçerli bir puan (1-5) seçin." }, { status: 400 });
  }
  if (text.length < 10 || text.length > 1000) {
    return NextResponse.json({ error: "Yorum 10 ile 1000 karakter arasında olmalıdır." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const purchased = await prisma.orderItem.findFirst({
    where: {
      variation: { productId },
      order: { userId: session.uid, status: { notIn: ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED"] } },
    },
    select: { id: true },
  });

  await prisma.review.upsert({
    where: { productId_userId: { productId, userId: session.uid } },
    create: { productId, userId: session.uid, rating: stars, comment: text, verified: Boolean(purchased) },
    update: { rating: stars, comment: text, verified: Boolean(purchased) },
  });

  return NextResponse.json({ success: true });
}
