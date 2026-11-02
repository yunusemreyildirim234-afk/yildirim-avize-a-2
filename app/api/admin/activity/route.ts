import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

// Müşteri hareket kayıtlarını (ClientEvent) siler. Kullanıcı hesaplarına (User) asla dokunmaz.
// keys: satır anahtarları (e-posta veya "s:<oturum>"); scope: "registered" | "guests" (sekmedeki tüm kayıtlar)
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));

  // Bir e-postaya bağlı oturumların e-postasız olayları da o müşteriye aittir
  const sessionsOf = async (emails: string[]) =>
    (await prisma.clientEvent.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { sessionId: true }, distinct: ["sessionId"] })).map((e) => e.sessionId);

  if (body.scope === "registered" || body.scope === "guests") {
    const users = await prisma.user.findMany({ where: { role: "USER", password: { not: "guest_checkout" } }, select: { email: true } });
    const regSessions = await sessionsOf(users.map((u) => u.email));
    const res = await prisma.clientEvent.deleteMany({
      where: body.scope === "registered" ? { sessionId: { in: regSessions } } : { sessionId: { notIn: regSessions } },
    });
    return NextResponse.json({ success: true, deleted: res.count });
  }

  const keys: string[] = Array.isArray(body.keys) ? body.keys.filter((k: unknown): k is string => typeof k === "string").slice(0, 500) : [];
  if (keys.length === 0) return NextResponse.json({ error: "Kayıt seçilmedi." }, { status: 400 });
  const sessionIds = keys.filter((k) => k.startsWith("s:")).map((k) => k.slice(2));
  const emails = keys.filter((k) => !k.startsWith("s:"));
  const linked = emails.length ? await sessionsOf(emails) : [];
  const res = await prisma.clientEvent.deleteMany({ where: { sessionId: { in: [...sessionIds, ...linked] } } });
  return NextResponse.json({ success: true, deleted: res.count });
}
