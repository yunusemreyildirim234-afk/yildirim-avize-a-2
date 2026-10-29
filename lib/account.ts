import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { USER_COOKIE, verifySession } from "@/lib/session";

/** Oturum açmış müşterinin ID'si (çerez geçerli ve kullanıcı hâlâ varsa), aksi halde null. */
export async function getSessionUserId() {
  const session = await verifySession<{ uid: string }>((await cookies()).get(USER_COOKIE)?.value);
  if (!session?.uid) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid }, select: { id: true } });
  return user?.id ?? null;
}
