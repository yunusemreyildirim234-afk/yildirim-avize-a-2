// HMAC imzalı oturum çerezleri (Web Crypto: hem proxy hem route handler içinde çalışır)
export const ADMIN_COOKIE = "ya_admin";
export const USER_COOKIE = "ya_user";
export const SESSION_MAX_AGE = 60 * 60 * 8;

const enc = new TextEncoder();

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET tanımlı değil.");
  return s;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(payload: Record<string, unknown>) {
  const body = toBase64Url(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + SESSION_MAX_AGE * 1000 })));
  return `${body}.${await hmac(body)}`;
}

export async function verifySession<T extends Record<string, unknown>>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, await hmac(body))) return null;
  try {
    // Üretim (signSession) UTF-8 bayt yazar; çözümde de baytlar UTF-8 olarak okunur (ş ğ ı İ ö ü ç bozulmasın). ASCII belirteçler aynen çözülür.
    const bin = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return json.exp > Date.now() ? (json as T) : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export function safeCompare(a: string, b: string) {
  return safeEqual(a, b);
}

/**
 * Oturum sürümü kontrolü. Belirteçte sürüm yoksa (eski oturumlar) 0 sayılır.
 * `dbVersion === null` (veritabanı okunamadı / kayıt yok) → mevcut davranış korunur, oturum geçersiz SAYILMAZ.
 */
export function versionMatches(tokenVersion: unknown, dbVersion: number | null): boolean {
  if (dbVersion === null) return true;
  const tv = typeof tokenVersion === "number" && Number.isInteger(tokenVersion) ? tokenVersion : 0;
  return tv === dbVersion;
}

/** İmzası/süresi doğrulanmış oturumun sürümünü veritabanındakiyle karşılaştırır; okuma hatası loglanır, oturum geçerli kalır. */
export async function verifyVersioned<T extends Record<string, unknown>>(session: T | null, field: "sv" | "av", readVersion: () => Promise<number | null>): Promise<T | null> {
  if (!session) return null;
  let dbVersion: number | null = null;
  try {
    dbVersion = await readVersion();
  } catch (err) {
    console.error("[oturum] sürüm okunamadı, mevcut davranış korunuyor:", (err as Error).message);
  }
  return versionMatches(session[field], dbVersion) ? session : null;
}

async function readAdminVersion(): Promise<number | null> {
  const { prisma } = await import("@/lib/db"); // proxy paketini şişirmemek için gerektiğinde yüklenir
  const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { adminSessionVersion: true } });
  return row?.adminSessionVersion ?? 0;
}

/** Test edilebilir çekirdek: imza + süre + role === "admin" + yönetici oturum sürümü ("av"). */
export async function verifyAdminSessionWith(token: string | null | undefined, readVersion: () => Promise<number | null>) {
  const session = await verifySession<{ role?: string; av?: number }>(token);
  return verifyVersioned(session?.role === "admin" ? session : null, "av", readVersion);
}

/** Yönetici oturumu: imza geçerli olmalı VE payload'da role === "admin" bulunmalı (üye/proof token'ları kabul edilmez); "av" veritabanıyla eşleşmeli. */
export async function verifyAdminSession(token?: string | null) {
  return verifyAdminSessionWith(token, readAdminVersion);
}
