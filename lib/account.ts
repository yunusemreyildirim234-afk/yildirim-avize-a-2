import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { USER_COOKIE, signSession, verifySession, verifyVersioned, versionMatches } from "@/lib/session";

type UserSession = { uid: string; sv?: number; picture?: string | null };

// İstek başına bir kez, yalnızca id ve sessionVersion okunur
const readUser = cache((uid: string) => prisma.user.findUnique({ where: { id: uid }, select: { id: true, sessionVersion: true } }));

/** Oturum açmış müşterinin ID'si (çerez geçerli, kullanıcı hâlâ var ve oturum sürümü eşleşiyorsa), aksi halde null. */
export async function getSessionUserId() {
  const session = await verifySession<UserSession>((await cookies()).get(USER_COOKIE)?.value);
  if (!session?.uid) return null;
  const user = await readUser(session.uid);
  if (!user || !versionMatches(session.sv, user.sessionVersion)) return null;
  return user.id;
}

/** Doğrulanmış müşteri oturumu (imza, süre, oturum sürümü). Kullanıcı silinmişse null; sürüm okunamazsa (DB hatası) oturum geçerli kalır (loglanır). */
export const getUserSession = cache(async (): Promise<UserSession | null> => {
  const session = await verifySession<UserSession>((await cookies()).get(USER_COOKIE)?.value);
  if (!session?.uid) return null;
  let deleted = false;
  const valid = await verifyVersioned(session, "sv", async () => {
    const user = await readUser(session.uid);
    if (!user) deleted = true;
    return user?.sessionVersion ?? null;
  });
  return deleted ? null : valid;
});

/** Kullanıcının güncel oturum sürümünü içeren yeni oturum belirteci. */
export async function issueUserToken(userId: string, extra: Record<string, unknown> = {}) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return signSession({ uid: userId, sv: u?.sessionVersion ?? 0, ...extra });
}

/** Sürümü artırır (eski tüm oturumlar geçersiz olur) ve yeni sürümü döner. */
export async function bumpUserSessionVersion(userId: string) {
  const u = await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  return u.sessionVersion;
}
