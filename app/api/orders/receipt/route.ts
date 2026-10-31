import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReceiptUploadedAdminEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel istek gövdesi sınırı ~4.5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// Havale dekontu: sipariş numarası (tahmin edilemez UUID) ile, onay sayfasındaki erişim modeliyle aynı
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const orderId = String(form?.get("orderId") ?? "");
  const senderName = String(form?.get("senderName") ?? "").trim().slice(0, 120);
  const file = form?.get("file");

  if (!orderId || senderName.length < 3) return NextResponse.json({ error: "Gönderici ad-soyadını giriniz." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Dekont dosyası seçiniz." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Yalnızca görsel (JPG, PNG, WEBP) veya PDF yüklenebilir." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Dosya en fazla 4 MB olabilir." }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true } } } });
  if (!order || order.paymentMethod !== "BANK_TRANSFER") return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.status !== "PENDING_NEW") return NextResponse.json({ error: "Bu sipariş için dekont yüklenemez." }, { status: 409 });

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.receiptFile.upsert({
    where: { orderId },
    create: { orderId, mime: file.type, data },
    update: { mime: file.type, data, createdAt: new Date() },
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
