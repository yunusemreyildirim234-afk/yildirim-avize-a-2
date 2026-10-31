import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { USER_COOKIE, verifySession } from "@/lib/session";
import { reviewEligibility } from "@/lib/reviews";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";
import { sendReviewAdminEmail } from "@/lib/email";

// Yorum yalnızca giriş yapmış ve ürünü satın almış müşteriye açıktır; ürün başına tek yorum yazılabilir.
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

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const eligibility = await reviewEligibility(session.uid, productId);
  if (eligibility.state === "no-purchase") {
    return NextResponse.json({ error: "Bu ürüne yalnızca ürünü satın almış olan müşterilerimiz yorum yapabilir." }, { status: 403 });
  }
  if (eligibility.state === "reviewed") {
    return NextResponse.json({ error: "Bu ürün için değerlendirmeniz bulunmaktadır." }, { status: 409 });
  }

  const author = await prisma.user.findUnique({ where: { id: session.uid }, select: { name: true, email: true } });
  try {
    await prisma.review.create({ data: { productId, userId: session.uid, rating: stars, comment: text, verified: true } });
  } catch {
    // @@unique([productId, userId]) yarış durumunda ikinci kaydı engeller
    return NextResponse.json({ error: "Bu ürün için değerlendirmeniz bulunmaktadır." }, { status: 409 });
  }

  const link = `/urun/${product.id}#yorumlar`;
  await Promise.allSettled([
    notifyAdmins({ title: `Yeni Ürün Yorumu: ${product.title} - ${stars} Yıldız`, message: `${author?.name ?? "Müşteri"}: ${text.slice(0, 120)}`, type: "SYSTEM", link }),
    notifyCustomer(
      { userId: session.uid },
      { title: "Değerlendirmeniz için teşekkür ederiz!", message: `Yorumunuz yayınlandı: ${product.title}`, type: "SYSTEM", link: `/urun/${product.id}` }
    ),
    sendReviewAdminEmail({ productTitle: product.title, productId: product.id, rating: stars, comment: text, name: author?.name ?? "Müşteri", email: author?.email ?? "" }),
  ]);

  return NextResponse.json({ success: true });
}
