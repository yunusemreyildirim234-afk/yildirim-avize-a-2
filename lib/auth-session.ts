// /api/auth/me yanıtından istemci oturum bilgisi (saf; tests/kota2-auth-baglam.test.mjs sınar).
export interface AuthUser {
  name: string;
  email: string;
  picture?: string | null;
}
export interface AuthSession {
  user: AuthUser | null;
  admin: boolean;
}

export const SIGNED_OUT: AuthSession = { user: null, admin: false };

/** Bozuk/eksik yanıt → çıkış yapılmış oturum; yalnızca bilinen alanlar taşınır. */
export function parseSession(data: unknown): AuthSession {
  if (!data || typeof data !== "object") return SIGNED_OUT;
  const d = data as { user?: { name?: unknown; email?: unknown; picture?: unknown } | null; admin?: unknown };
  const u = d.user;
  const user = u && typeof u === "object" && typeof u.email === "string" ? { name: typeof u.name === "string" ? u.name : "", email: u.email, picture: typeof u.picture === "string" ? u.picture : null } : null;
  return { user, admin: d.admin === true };
}
