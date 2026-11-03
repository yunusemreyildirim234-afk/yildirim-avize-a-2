import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { purgeOldEvents } from "@/lib/activity";

const TYPES = ["SEARCH", "CART_ADD", "CHECKOUT_START", "ERROR"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Hafif müşteri olay kaydı. Müşteri akışını asla bozmaz: her durumda 204 benzeri başarı döner.
export async function POST(req: Request) {
  const rl = rateLimit(req, "events", 60, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  try {
    const body = await req.json().catch(() => ({}));
    const type = str(body.type, 20);
    const sessionId = str(body.sessionId, 64);
    if (!TYPES.includes(type) || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) return NextResponse.json({ ok: false }, { status: 400 });

    // Kimlik YALNIZCA sunucuda doğrulanmış oturumdan (ya_user çerezi) gelir. İstemcinin gönderdiği e-posta doğrulanmadığı için
    // üyeymiş gibi kullanılmaz; oturum yoksa etkinlik misafir kalır (email = null).
    let email: string | null = null;
    const userId = await getSessionUserId();
    if (userId) email = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? null;

    await prisma.clientEvent.create({ data: { type, sessionId, email, detail: str(body.detail, 300) || null, page: str(body.page, 120) || null } });
    if (Math.random() < 0.05) await purgeOldEvents();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[events] kaydedilemedi:", (e as Error).message);
    return NextResponse.json({ ok: false });
  }
}
