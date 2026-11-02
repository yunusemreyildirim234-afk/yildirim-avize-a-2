import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReceiptUploadedAdminEmail } from "@/lib/email";
import { cookies } from "next/headers";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { notifyAdmins } from "@/lib/notifications";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { RECEIPT_MIMES, validateUpload } from "@/lib/uploads";


// Havale dekontu: sipariş numarası (tahmin edilemez UUID) ile, onay sayfasındaki erişim modeliyle aynı
export async function POST(req: Request) {
  const rl = rateLimit(req, "receipt", 5, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter, "Kısa sürede çok fazla dekont yüklediniz. Lütfen birkaç dakika sonra tekrar deneyin.");
  const form = await req.formData().catch(() => null);
  const orderId = String(form?.get("orderId") ?? "");
  const senderName = String(form?.get("senderName") ?? "").trim().slice(0, 120);
  const file = form?.get("file");

  if (!orderId || senderName.length < 3) return NextResponse.json({ error: "Gönderici ad-soyadını giriniz." }, { status: 400 });
  const upload = await validateUpload(file, RECEIPT_MIMES);
  if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true, password: true } } } });
  if (!order || order.paymentMethod !== "BANK_TRANSFER") return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.status !== "PENDING_NEW") return NextResponse.json({ error: "Bu sipariş için dekont yüklenemez." }, { status: 409 });

  // Mevcut dekont yalnızca sipariş sahibi veya yönetici tarafından değiştirilebilir (UUID bilen biri üzerine yazamaz)
  const existing = await prisma.receiptFile.findUnique({ where: { orderId }, select: { orderId: true } });
  if (existing) {
    // Misafir siparişi (üyeliksiz): sipariş 24 saatten yeniyse oturum aranmadan güncellenebilir.
    // Üyeye bağlı siparişte yalnızca sipariş sahibi veya yönetici değiştirebilir.
    const isGuestOrder = order.user.password === "guest_checkout";
    const guestWindowOpen = isGuestOrder && Date.now() - order.createdAt.getTime() < 24 * 60 * 60 * 1000;
    if (!guestWindowOpen) {
      const isAdmin = Boolean(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value));
      const uid = isAdmin ? null : await getSessionUserId();
      if (!isAdmin && (isGuestOrder || uid !== order.userId)) {
        return NextResponse.json({ error: "Bu sipariş için zaten dekont yüklenmiş. Değiştirmek için hesabınıza giriş yapın veya bizimle iletişime geçin." }, { status: 403 });
      }
    }
  }

  const { mime, data } = upload;
  await prisma.receiptFile.upsert({
    where: { orderId },
    create: { orderId, mime, data },
    update: { mime, data, createdAt: new Date() },
  });
  await prisma.order.update({ where: { id: orderId }, data: { receiptUrl: `/api/receipts/${orderId}`, receiptSenderName: senderName } });

  await notifyAdmins({
    title: `Dekont Yüklendi: #${orderId.slice(0, 8)}`,
    message: `${order.user.name} • Gönderici: ${senderName}`,
    type: "ORDER",
    link: "/admin#siparisler",
  });
  await sendReceiptUploadedAdminEmail({ orderId, senderName, customerName: order.user.name, totalAmount: order.totalAmount }).catch(() => false);

  return NextResponse.json({ success: true });
}
