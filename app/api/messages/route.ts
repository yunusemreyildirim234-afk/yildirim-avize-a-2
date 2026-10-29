import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";

// Müşterinin kendi mesajları ve ürün soruları (yanıtlarıyla birlikte)
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const rows = await prisma.contactMessage.findMany({
    where: { OR: [{ userId }, { email: user.email.toLowerCase() }] },
    include: { product: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      subject: m.subject,
      message: m.message,
      status: m.status,
      reply: m.reply,
      repliedAt: m.repliedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      product: m.product,
    })),
  });
}
