import { NextResponse } from "next/server";
import { serverError, badRequest } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/account";
import { sendNewMessageEmail, sendQuestionReceivedEmail } from "@/lib/email";
import { CONTACT_CONFIRM_DAILY_LIMIT } from "@/lib/contact-confirm";
import { notifyAdmins } from "@/lib/notifications";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// İletişim formu ve ürün sorusu: veritabanına kaydeder, yöneticilere e-posta gönderir
export async function POST(req: Request) {
  const rl = rateLimit(req, "contact", 3, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter, "Çok fazla mesaj gönderdiniz. Lütfen 10 dakika sonra tekrar deneyin.");
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest();
    }
    if (!body || typeof body !== "object") return badRequest();
    const name = clean(body.name, 120);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 40);
    const subject = clean(body.subject, 200);
    const message = clean(body.message, 3000);
    const productIdRaw = clean(body.productId, 100);

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Lütfen gerekli alanları doldurunuz." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
    }

    const product = productIdRaw
      ? await prisma.product.findUnique({ where: { id: productIdRaw }, select: { id: true, title: true } })
      : null;
    const kind = product ? "PRODUCT_QUESTION" : "CONTACT";

    const saved = await prisma.contactMessage.create({
      data: {
        kind,
        userId: await getSessionUserId(),
        name,
        email,
        phone: phone || null,
        subject: subject || null,
        message,
        productId: product?.id ?? null,
      },
    });

    await notifyAdmins({
      title: `Yeni Soru/Mesaj: ${product?.title || subject || "Genel"}`,
      message: `${name} (${email})`,
      type: "QUESTION",
      link: "/admin#mesajlar",
    });

    // Bildirim e-postası başarısız olsa bile mesaj kaydedilmiştir
    const emailed = await sendNewMessageEmail({
      kind,
      name,
      email,
      phone,
      subject,
      message,
      productTitle: product?.title,
    }).catch(() => false);
    // Aynı adrese günde en çok CONTACT_CONFIRM_DAILY_LIMIT onay e-postası (kayıtlı mesajlardan sayılır; başkasının adresine yağdırma engellenir)
    const sentToday = await prisma.contactMessage.count({ where: { email, createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) } } });
    if (sentToday <= CONTACT_CONFIRM_DAILY_LIMIT) {
      await sendQuestionReceivedEmail({ to: email, productTitle: product?.title }).catch((err) => console.error("[email] Müşteri onay maili hatası:", err));
    }
    if (!emailed) console.warn("Yönetici bildirim e-postası gönderilemedi (mesaj:", saved.id, ")");

    return NextResponse.json({
      success: true,
      message:
        kind === "PRODUCT_QUESTION"
          ? "Sorunuz iletildi. Yanıtı e-posta ile alacak ve Hesabım → Ürün Sorularım / Mesajlarım bölümünden görebileceksiniz."
          : "Talebiniz Beyoğlu merkezimize ulaştı. Uzman ekibimiz en kısa sürede dönüş yapacaktır.",
    });
  } catch (error) {
    return serverError("contact", error, "Mesajınız gönderilemedi. Lütfen tekrar deneyin.");
  }
}
