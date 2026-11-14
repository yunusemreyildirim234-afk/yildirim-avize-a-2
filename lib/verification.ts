import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { MAX_ATTEMPTS, consumeWith, type CodeStore } from "@/lib/code-consume";
import { signSession, verifySession } from "@/lib/session";

export type CodeType = "REGISTER" | "RESET_PASSWORD" | "CHANGE_PASSWORD" | "TWO_FACTOR_ENABLE" | "TWO_FACTOR_DISABLE" | "TWO_FACTOR_LOGIN" | "ADMIN_LOGIN" | "ADMIN_PASSWORD";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_WAIT_SECONDS = 60;

export const clientIp = (req: Request) => {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  return raw.replace(/^::ffff:/, "") || null;
};

/** 60 sn içinde aynı e-posta veya IP'den ikinci kod isteğini engeller; kalan saniyeyi döner. `type` verilirse yalnızca AYNI türdeki kodlar sayılır (şifre değiştirme kodu giriş/2FA kodunu engellemez). */
export async function rateLimitRemaining(email: string, ip: string | null, type?: CodeType): Promise<number> {
  const since = new Date(Date.now() - RESEND_WAIT_SECONDS * 1000);
  const last = await prisma.verificationCode.findFirst({
    where: { createdAt: { gt: since }, ...(type ? { type } : {}), OR: [{ email }, ...(ip ? [{ ip }] : [])] },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return 0;
  return Math.max(1, Math.ceil((last.createdAt.getTime() + RESEND_WAIT_SECONDS * 1000 - Date.now()) / 1000));
}

/** Eski kullanılmamış kodları geçersiz kılıp yeni 6 haneli kod üretir. */
export async function createCode(email: string, type: CodeType, ip: string | null) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.verificationCode.updateMany({ where: { email, type, used: false }, data: { used: true } });
  await prisma.verificationCode.create({ data: { email, type, code, ip, expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
  return code;
}

const dbStore: CodeStore = {
  findActive: (email, type) =>
    prisma.verificationCode.findFirst({
      where: { email, type, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true },
    }),
  recentAttempts: async (email, since) => {
    const r = await prisma.verificationCode.aggregate({ where: { email, createdAt: { gt: since } }, _sum: { attempts: true } });
    return r._sum.attempts ?? 0;
  },
  recordWrong: async (id) => {
    await prisma.$executeRaw`UPDATE "VerificationCode" SET "attempts" = "attempts" + 1, "used" = ("attempts" + 1 >= ${MAX_ATTEMPTS}) WHERE "id" = ${id} AND "used" = false`;
  },
  claim: async (id) => (await prisma.verificationCode.updateMany({ where: { id, used: false }, data: { used: true } })).count > 0,
};

/** Kod doğru, süresi dolmamış ve kullanılmamışsa used=true yapar (kurallar: lib/code-consume.ts). */
export const consumeCode = (email: string, type: CodeType, code: string): Promise<boolean> => consumeWith(dbStore, email, type, code);

// Doğrulanmış kod kanıtı (sonraki adımda şifre belirlemek için) ve 2FA bekleyen giriş jetonu: 10 dk geçerli
interface Proof {
  email: string;
  purpose: string;
  at: number;
  uid?: string;
  [key: string]: unknown;
}

export const issueProof = (email: string, purpose: string, uid?: string) => signSession({ email, purpose, at: Date.now(), uid });

export async function readProof(token: unknown, email: string, purpose: string): Promise<Proof | null> {
  if (typeof token !== "string") return null;
  const p = await verifySession<Proof>(token);
  if (!p || p.purpose !== purpose || p.email !== email || Date.now() - p.at > CODE_TTL_MS) return null;
  return p;
}
