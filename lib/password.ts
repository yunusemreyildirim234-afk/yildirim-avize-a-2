import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

let dummyHash: string | null = null;

/**
 * Hesap yoksa ya da hesabın şifresi yoksa (misafir, Google) da aynı maliyetli scrypt çalışır: yanıt süresinden hesap varlığı anlaşılmaz.
 * Yalnızca gerçek bir scrypt şifresi doğruysa true döner.
 */
export function verifyPasswordOrDummy(password: string, stored: string | null | undefined): boolean {
  const usable = !!stored && stored.startsWith("scrypt$");
  dummyHash ??= hashPassword("dummy-customer-login-timing");
  const ok = verifyPassword(password, usable ? stored : dummyHash);
  return usable && ok;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
