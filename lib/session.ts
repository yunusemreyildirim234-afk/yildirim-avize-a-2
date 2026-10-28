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
    const json = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
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
