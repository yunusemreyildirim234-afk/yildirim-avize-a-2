import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { sendReplyEmail } from "@/lib/email";
import { notifyCustomer } from "@/lib/notifications";

import { rateLimit, tooMany } from "@/lib/rate-limit";
import type { AdminMessage } from "@/components/AdminMessages";

// Mesaj/soru listesi (en çok 200): panel sayfasıyla değil, "Gelen Mesajlar" bölümü açılınca istenir. Bekleyenler üstte, kendi içinde en yeni önce.
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-messages", 30, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const rows = await prisma.contactMessage.findMany({ include: { product: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  rows.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.createdAt.getTime() - a.createdAt.getTime());
  const list: AdminMessage[] = rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
    message: m.message,
    status: m.status,
    reply: m.reply,
    repliedAt: m.repliedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    productTitle: m.product?.title ?? null,
  }));
  return NextResponse.json(list);
}

// Seçili mesaj/soruları kalıcı siler
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? [...new Set<string>(body.ids.filter((i: unknown): i is string => typeof i === "string"))].slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Mesaj seçilmedi." }, { status: 400 });
  const res = await prisma.contactMessage.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ success: true, deleted: res.count });
}

// Yönetici yanıtı: kaydeder ve müşterinin e-posta adresine gönderir (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 5000) : "";
  if (!id || !reply) return NextResponse.json({ error: "Yanıt metni zorunludur." }, { status: 400 });

  const existing = await prisma.contactMessage.findUnique({ where: { id }, include: { product: { select: { title: true } } } });
  if (!existing) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { reply, repliedAt: new Date(), status: "ANSWERED" },
  });

  await notifyCustomer(
    { userId: existing.userId, email: existing.email },
    {
      title: "Sorunuz yanıtlandı!",
      message: existing.product?.title ? `"${existing.product.title}" hakkındaki sorunuza yanıt verdik.` : "Mesajınıza yanıt verdik.",
      type: "QUESTION",
      link: "/giris#mesajlar",
    }
  );

  const emailed = await sendReplyEmail({
    to: existing.email,
    name: existing.name,
    question: existing.message,
    reply,
    productTitle: existing.product?.title,
  }).catch(() => false);

  return NextResponse.json({
    success: true,
    emailed,
    repliedAt: updated.repliedAt?.toISOString() ?? null,
  });
}
