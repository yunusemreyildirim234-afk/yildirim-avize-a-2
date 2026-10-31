import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { signSession, verifySession } from "@/lib/session";

export type CodeType = "REGISTER" | "RESET_PASSWORD" | "CHANGE_PASSWORD" | "TWO_FACTOR_ENABLE" | "TWO_FACTOR_LOGIN";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_WAIT_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export const clientIp = (req: Request) => {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  return raw.replace(/^::ffff:/, "") || null;
};

/** 60 sn içinde aynı e-posta veya IP'den ikinci kod isteğini engeller; kalan saniyeyi döner. */
export async function rateLimitRemaining(email: string, ip: string | null): Promise<number> {
  const since = new Date(Date.now() - RESEND_WAIT_SECONDS * 1000);
  const last = await prisma.verificationCode.findFirst({
    where: { createdAt: { gt: since }, OR: [{ email }, ...(ip ? [{ ip }] : [])] },
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

/** Kod doğru, süresi dolmamış ve kullanılmamışsa used=true yapar. Çok sayıda yanlış denemede kodu iptal eder. */
export async function consumeCode(email: string, type: CodeType, code: string): Promise<boolean> {
  const active = await prisma.verificationCode.findFirst({
    where: { email, type, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return false;
  if (active.code !== code.trim()) {
    const attempts = active.attempts + 1;
    await prisma.verificationCode.update({ where: { id: active.id }, data: { attempts, used: attempts >= MAX_ATTEMPTS } });
    return false;
  }
  const claimed = await prisma.verificationCode.updateMany({ where: { id: active.id, used: false }, data: { used: true } });
  return claimed.count > 0;
}

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
