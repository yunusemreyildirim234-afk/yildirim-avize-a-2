import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Müşteri hareket kayıtlarını (ClientEvent) siler. Kullanıcı hesaplarına (User) asla dokunmaz.
// keys: satır anahtarları (e-posta veya "s:<oturum>"); scope: "registered" | "guests" (sekmedeki tüm kayıtlar)
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-activity-delete", 30, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const body = await req.json().catch(() => ({}));

  // Bir e-postaya bağlı oturumların e-postasız olayları da o müşteriye aittir
  const sessionsOf = async (emails: string[]) =>
    (await prisma.clientEvent.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { sessionId: true }, distinct: ["sessionId"] })).map((e) => e.sessionId);

  if (body.scope === "guests") {
    // Tek sorgu: üye e-postasına bağlı oturumu OLMAYAN tüm olaylar silinir (binlerce parametreli NOT IN yerine NOT EXISTS alt sorgusu).
    // "Üye" = USER rolünde, misafir ödeme hesabı olmayan kullanıcı; eşleşme e-postaya göre büyük/küçük harf duyarsızdır (sessionsOf ile aynı kural).
    const deleted = await prisma.$executeRaw`
      DELETE FROM "ClientEvent" AS e
      WHERE NOT EXISTS (
        SELECT 1 FROM "ClientEvent" r
        JOIN "User" u ON lower(r."email") = lower(u."email")
        WHERE r."sessionId" = e."sessionId" AND u."role" = 'USER' AND u."password" <> 'guest_checkout'
      )`;
    return NextResponse.json({ success: true, deleted });
  }
  if (body.scope === "registered") {
    const users = await prisma.user.findMany({ where: { role: "USER", password: { not: "guest_checkout" } }, select: { email: true } });
    const regSessions = await sessionsOf(users.map((u) => u.email));
    const res = await prisma.clientEvent.deleteMany({ where: { sessionId: { in: regSessions } } });
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
