import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanGuestEmail } from "./guest-email.ts";

// Abonelikten çıkış bağlantısı belirteci (e-posta tabanlı: onay kaydı MarketingConsent.email ile tutulur).
// Saf modül: veritabanına dokunmaz, gizli anahtar çağrı anında okunur (birim test edilebilir).

export const normalizeEmail = (email: string) => cleanGuestEmail(email.trim()).toLowerCase();

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function tokenSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET tanımlı değil.");
  return s;
}

const mac = (email: string) => createHmac("sha256", tokenSecret()).update(`unsubscribe:${email}`).digest();

/** Abonelikten çıkış bağlantısı için imzalı belirteç: base64url(e-posta).HMAC-SHA256. Süresizdir (eski e-postalardaki bağlantı da çalışır). */
export function signUnsubscribeToken(email: string): string {
  const e = normalizeEmail(email);
  return `${b64url(Buffer.from(e, "utf8"))}.${b64url(mac(e))}`;
}

/** Geçerliyse e-postayı döndürür; imza hatalıysa veya bozuksa null. */
export function verifyUnsubscribeToken(token: string | undefined | null): string | null {
  try {
    if (!token) return null;
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const email = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    if (!email || email !== normalizeEmail(email)) return null;
    const expected = Buffer.from(b64url(mac(email)));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given) ? email : null;
  } catch {
    return null;
  }
}
