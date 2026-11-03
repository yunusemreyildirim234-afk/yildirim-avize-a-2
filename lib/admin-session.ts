import { prisma } from "@/lib/db";
import { signSession } from "@/lib/session";

/** Güncel yönetici oturum sürümünü ("av") içeren yeni yönetici belirteci. Okunamazsa 0. */
export async function issueAdminToken() {
  let av = 0;
  try {
    av = (await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { adminSessionVersion: true } }))?.adminSessionVersion ?? 0;
  } catch (err) {
    console.error("[oturum] yönetici sürümü okunamadı:", (err as Error).message);
  }
  return signSession({ role: "admin", av });
}

/** Tüm yönetici oturumlarını geçersiz kılar (sürümü artırır) ve çağıran için yeni belirteç döner. */
export async function revokeAdminSessions() {
  const row = await prisma.siteConfig.upsert({
    where: { id: 1 },
    create: { id: 1, adminSessionVersion: 1 },
    update: { adminSessionVersion: { increment: 1 } },
    select: { adminSessionVersion: true },
  });
  return signSession({ role: "admin", av: row.adminSessionVersion });
}
