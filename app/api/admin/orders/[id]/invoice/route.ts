import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { cleanGuestEmail } from "@/lib/guest-email";
import { sendInvoiceEmail } from "@/lib/email";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { INVOICE_PENDING_MSG, MAX_INVOICE_BYTES, invoiceHeaders, isMissingTable, sanitizeFileName } from "@/lib/invoice";

type Ctx = { params: Promise<{ id: string }> };

const pending = () => NextResponse.json({ error: INVOICE_PENDING_MSG, pending: true }, { status: 503 });
const fail = (e: unknown) => {
  if (isMissingTable(e)) return pending();
  console.error("[invoice] hata:", (e as Error).message);
  return NextResponse.json({ error: "Fatura işlemi tamamlanamadı." }, { status: 500 });
};

/** Faturayı müşteriye ek olarak gönderir; başarılıysa emailSentAt işaretlenir. Başarısızlıkta fatura silinmez. */
async function emailInvoice(orderId: string): Promise<boolean> {
  const inv = await prisma.orderInvoice.findUnique({ where: { orderId } });
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { name: true, email: true } } } });
  if (!inv || !order) return false;
  const ok = await sendInvoiceEmail({
    to: cleanGuestEmail(order.user.email),
    name: order.user.name,
    orderId,
    fileName: inv.fileName,
    pdf: Buffer.from(inv.data),
  }).catch(() => false);
  if (ok) await prisma.orderInvoice.update({ where: { orderId }, data: { emailSentAt: new Date() } });
  return ok;
}

// Faturayı yükle / değiştir (yalnızca teslim edilmiş sipariş). Başarılıysa müşteriye otomatik e-posta gider.
export async function POST(req: Request, ctx: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "invoice-upload", 20, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  try {
    const { id } = await ctx.params;
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    if (order.status !== "DELIVERED") return NextResponse.json({ error: "Fatura yalnızca teslim edilmiş siparişlere yüklenebilir." }, { status: 409 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "PDF dosyası seçiniz." }, { status: 400 });
    if (file.size > MAX_INVOICE_BYTES) return NextResponse.json({ error: "Fatura en fazla 3 MB olabilir." }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Yalnızca PDF yüklenebilir." }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    if (data.length < 5 || data.toString("ascii", 0, 5) !== "%PDF-") return NextResponse.json({ error: "Dosya içeriği geçerli bir PDF değil." }, { status: 400 });

    const fileName = sanitizeFileName(file.name);
    await prisma.orderInvoice.upsert({
      where: { orderId: id },
      create: { orderId: id, fileName, mimeType: "application/pdf", size: data.length, data },
      update: { fileName, mimeType: "application/pdf", size: data.length, data, uploadedAt: new Date(), emailSentAt: null },
    });

    const emailed = await emailInvoice(id);
    return NextResponse.json({ success: true, emailed });
  } catch (e) {
    return fail(e);
  }
}

// E-postayı yeniden gönder (çift tıklamaya karşı sipariş+IP başına 15 sn'de bir)
export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const rl = rateLimit(req, `invoice-mail-${id}`, 1, 15_000);
    if (rl.limited) return tooMany(rl.retryAfter, "Bu fatura az önce gönderildi. Birkaç saniye bekleyip tekrar deneyin.");
    const exists = await prisma.orderInvoice.findUnique({ where: { orderId: id }, select: { orderId: true } });
    if (!exists) return NextResponse.json({ error: "Bu sipariş için yüklenmiş fatura yok." }, { status: 404 });
    const emailed = await emailInvoice(id);
    if (!emailed) return NextResponse.json({ error: "E-posta gönderilemedi, lütfen yeniden deneyin.", emailed: false }, { status: 502 });
    return NextResponse.json({ success: true, emailed: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    await prisma.orderInvoice.deleteMany({ where: { orderId: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}

// Yönetici faturayı indirir
export async function GET(_req: Request, ctx: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const inv = await prisma.orderInvoice.findUnique({ where: { orderId: id } });
    if (!inv) return new Response("Bulunamadı", { status: 404 });
    return new Response(new Uint8Array(inv.data), { headers: invoiceHeaders(inv.fileName) });
  } catch (e) {
    return fail(e);
  }
}
