import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { getUserSession } from "@/lib/account";
import { buildNotificationWhere, parseNotificationScope } from "@/lib/notification-scope";

// Oturumdaki müşteri ve/veya yöneticiye ait bildirimleri kapsayan filtre; ?scope=admin|user kümeyi tek tarafa daraltır
async function scope(req: Request, mode: "read" | "delete" = "read") {
  const jar = await cookies();
  const [userSession, adminSession] = await Promise.all([
    getUserSession(),
    verifyAdminSession(jar.get(ADMIN_COOKIE)?.value),
  ]);
  const user = userSession?.uid ? await prisma.user.findUnique({ where: { id: userSession.uid }, select: { id: true, email: true } }) : null;
  const wanted = parseNotificationScope(new URL(req.url).searchParams.get("scope"));
  return buildNotificationWhere({ user, admin: Boolean(adminSession) }, wanted, mode) as Prisma.NotificationWhereInput | null;
}

export async function GET(req: Request) {
  const where = await scope(req);
  if (!where) return NextResponse.json({ items: [], unread: 0 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.notification.count({ where: { AND: [where, { read: false }] } }),
  ]);
  return NextResponse.json({ items, unread });
}

// scope=admin|user yalnızca o kümeyi siler; scope yoksa müşteri oturumu varsa yalnızca müşterinin, yoksa yöneticinin kümesi silinir (çift oturumda diğer taraf silinmez).
// Kapsam scope() ile sınırlıdır: müşteri yalnızca kendi kayıtlarını, yönetici kayıtları ise yalnızca geçerli yönetici oturumuyla silebilir.
export async function DELETE(req: Request) {
  const where = await scope(req, "delete");
  if (!where) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const { count } = await prisma.notification.deleteMany({ where });
  return NextResponse.json({ success: true, deleted: count });
}

// { all: true } tümünü, { id } tek bildirimi okundu yapar
export async function POST(req: Request) {
  const where = await scope(req);
  if (!where) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const filter: Prisma.NotificationWhereInput =
    typeof body.id === "string" ? { AND: [where, { id: body.id }] } : body.all ? { AND: [where, { read: false }] } : { id: "" };
  await prisma.notification.updateMany({ where: filter, data: { read: true } });
  return NextResponse.json({ success: true });
}
