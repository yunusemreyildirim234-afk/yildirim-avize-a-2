import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReceiptUploadedAdminEmail } from "@/lib/email";
import { cookies } from "next/headers";
import { getSessionUserId } from "@/lib/account";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { notifyAdmins } from "@/lib/notifications";
import { RECEIPT_MIMES, validateUpload } from "@/lib/uploads";


// Havale dekontu: sipariş numarası (tahmin edilemez UUID) ile, onay sayfasındaki erişim modeliyle aynı
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const orderId = String(form?.get("orderId") ?? "");
  const senderName = String(form?.get("senderName") ?? "").trim().slice(0, 120);
  const file = form?.get("file");

  if (!orderId || senderName.length < 3) return NextResponse.json({ error: "Gönderici ad-soyadını giriniz." }, { status: 400 });
  const upload = await validateUpload(file, RECEIPT_MIMES);
  if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true } } } });
  if (!order || order.paymentMethod !== "BANK_TRANSFER") return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.status !== "PENDING_NEW") return NextResponse.json({ error: "Bu sipariş için dekont yüklenemez." }, { status: 409 });

  // Mevcut dekont yalnızca sipariş sahibi veya yönetici tarafından değiştirilebilir (UUID bilen biri üzerine yazamaz)
  const existing = await prisma.receiptFile.findUnique({ where: { orderId }, select: { orderId: true } });
  if (existing) {
    const isAdmin = Boolean(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value));
    const uid = isAdmin ? null : await getSessionUserId();
    if (!isAdmin && uid !== order.userId) {
      return NextResponse.json({ error: "Bu sipariş için zaten dekont yüklenmiş. Değiştirmek için hesabınıza giriş yapın." }, { status: 403 });
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
