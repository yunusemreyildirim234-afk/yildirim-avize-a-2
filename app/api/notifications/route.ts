import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, USER_COOKIE, verifySession } from "@/lib/session";

// Oturumdaki müşteri ve/veya yöneticiye ait bildirimleri kapsayan filtre
async function scope(): Promise<Prisma.NotificationWhereInput | null> {
  const jar = await cookies();
  const [userSession, adminSession] = await Promise.all([
    verifySession<{ uid: string }>(jar.get(USER_COOKIE)?.value),
    verifySession(jar.get(ADMIN_COOKIE)?.value),
  ]);
  const or: Prisma.NotificationWhereInput[] = [];
  if (userSession?.uid) {
    const user = await prisma.user.findUnique({ where: { id: userSession.uid }, select: { id: true, email: true } });
    if (user) or.push({ userId: user.id }, { userEmail: { equals: user.email, mode: "insensitive" } });
  }
  if (adminSession) or.push({ userId: null, userEmail: null });
  return or.length ? { OR: or } : null;
}

export async function GET() {
  const where = await scope();
  if (!where) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.notification.count({ where: { AND: [where, { read: false }] } }),
  ]);
  return NextResponse.json({ items, unread });
}

// { all: true } tümünü, { id } tek bildirimi okundu yapar
export async function POST(req: Request) {
  const where = await scope();
  if (!where) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const filter: Prisma.NotificationWhereInput =
    typeof body.id === "string" ? { AND: [where, { id: body.id }] } : body.all ? { AND: [where, { read: false }] } : { id: "" };
  await prisma.notification.updateMany({ where: filter, data: { read: true } });
  return NextResponse.json({ success: true });
}
