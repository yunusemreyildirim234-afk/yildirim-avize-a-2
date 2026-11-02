import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { USER_COOKIE, verifySession } from "@/lib/session";
import { reviewEligibility, REVIEW_STATUS } from "@/lib/reviews";
import { IMAGE_MIMES, validateUpload } from "@/lib/uploads";
import { notifyAdmins, notifyCustomer } from "@/lib/notifications";
import { sendReviewAdminEmail } from "@/lib/email";

// Yorum yalnızca giriş yapmış ve ürünü satın almış müşteriye açıktır; ürün başına tek yorum yazılabilir.
export async function POST(req: Request) {
  const session = await verifySession<{ uid: string }>((await cookies()).get(USER_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Yorum yazmak için giriş yapmalısınız." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const productId = form.get("productId");
  const stars = Number(form.get("rating"));
  const rawComment = form.get("comment");
  const text = typeof rawComment === "string" ? rawComment.trim() : "";
  const photo = form.get("image");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (typeof productId !== "string" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Geçerli bir puan (1-5) seçin." }, { status: 400 });
  }
  if (text.length < 10 || text.length > 1000) {
    return NextResponse.json({ error: "Yorum 10 ile 1000 karakter arasında olmalıdır." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  let upload: Awaited<ReturnType<typeof validateUpload>> | null = null;
  if (hasPhoto) {
    upload = await validateUpload(photo, IMAGE_MIMES);
    if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });
  }

  const eligibility = await reviewEligibility(session.uid, productId);
  if (eligibility.state === "no-purchase") {
    return NextResponse.json({ error: "Bu ürüne yalnızca ürünü satın almış olan müşterilerimiz yorum yapabilir." }, { status: 403 });
  }
  if (eligibility.state === "reviewed") {
    return NextResponse.json({ error: "Bu ürün için değerlendirmeniz bulunmaktadır." }, { status: 409 });
  }

  const author = await prisma.user.findUnique({ where: { id: session.uid }, select: { name: true, email: true } });
  try {
    // Daha önce reddedilmiş yorum varsa yenisiyle değiştirilir
    await prisma.review.deleteMany({ where: { productId, userId: session.uid, status: REVIEW_STATUS.REJECTED } });
    const created = await prisma.review.create({
      data: { productId, userId: session.uid, orderId: eligibility.orderId, rating: stars, comment: text, verified: true, status: REVIEW_STATUS.PENDING },
    });
    if (upload?.ok) {
      await prisma.reviewImage.create({ data: { reviewId: created.id, mime: upload.mime, data: upload.data } });
      await prisma.review.update({ where: { id: created.id }, data: { imageUrl: `/api/review-images/${created.id}` } });
    }
  } catch {
    // @@unique([productId, userId]) yarış durumunda ikinci kaydı engeller
    return NextResponse.json({ error: "Bu ürün için değerlendirmeniz bulunmaktadır." }, { status: 409 });
  }

  const link = "/admin#yorumlar";
  await Promise.allSettled([
    notifyAdmins({ title: `Onay Bekleyen Yorum${upload?.ok ? " + Fotoğraf" : ""}: ${product.title} - ${stars} Yıldız`, message: `${author?.name ?? "Müşteri"}: ${text.slice(0, 120)}`, type: "SYSTEM", link }),
    notifyCustomer(
      { userId: session.uid },
      { title: "Değerlendirmeniz için teşekkür ederiz!", message: `Yorumunuz incelendikten sonra yayınlanacaktır: ${product.title}`, type: "SYSTEM", link: `/urun/${product.id}` }
    ),
    sendReviewAdminEmail({ productTitle: product.title, productId: product.id, rating: stars, comment: text, name: author?.name ?? "Müşteri", email: author?.email ?? "" }),
  ]);

  return NextResponse.json({ success: true });
}
