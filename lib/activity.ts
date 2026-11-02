import { prisma } from "@/lib/db";
import { cleanGuestEmail } from "@/lib/guest-email";

const DAY = 86_400_000;
export const RETENTION_MS = 3 * DAY;

/** 3 günden eski olay kayıtlarını siler. Tablo yoksa/sorgu hata verirse sessizce geçer. */
export async function purgeOldEvents() {
  try {
    await prisma.clientEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
  } catch (e) {
    console.error("[activity] temizlik yapılamadı:", (e as Error).message);
  }
}

export interface ActivityRow {
  key: string;
  email: string | null;
  name: string | null;
  registeredAt: string | null; // yalnızca üyeler
  firstAt: string | null;
  lastAt: string | null;
  activeMinutes: number;
  searches: string[];
  cartAdds: string[];
  checkoutStarts: number;
  errors: { at: string; page: string | null; detail: string }[];
}

const empty = (key: string, email: string | null): ActivityRow => ({
  key, email, name: null, registeredAt: null, firstAt: null, lastAt: null, activeMinutes: 0, searches: [], cartAdds: [], checkoutStarts: 0, errors: [],
});

/** Son 3 günün olaylarını müşteri (e-posta) veya anonim oturum bazında gruplar. */
export async function getActivity(): Promise<{ registered: ActivityRow[]; guests: ActivityRow[]; ok: boolean }> {
  try {
    await purgeOldEvents();
    const [users, events] = await Promise.all([
      prisma.user.findMany({ where: { role: "USER", password: { not: "guest_checkout" } }, select: { name: true, email: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.clientEvent.findMany({ orderBy: { createdAt: "asc" }, take: 5000 }),
    ]);

    // Aynı oturumun herhangi bir olayında e-posta varsa tüm oturum o e-postaya bağlanır
    const sessionEmail = new Map<string, string>();
    for (const e of events) if (e.email) sessionEmail.set(e.sessionId, cleanGuestEmail(e.email).toLowerCase());

    const rows = new Map<string, ActivityRow>();
    for (const u of users) {
      const key = u.email.toLowerCase();
      rows.set(key, { ...empty(key, u.email), name: u.name, registeredAt: u.createdAt.toISOString() });
    }
    const registeredKeys = new Set(rows.keys());

    for (const e of events) {
      const email = sessionEmail.get(e.sessionId) ?? null;
      const key = email ?? `s:${e.sessionId}`;
      let r = rows.get(key);
      if (!r) {
        r = empty(key, email);
        rows.set(key, r);
      }
      const at = e.createdAt.toISOString();
      r.firstAt ??= at;
      r.lastAt = at;
      if (e.type === "SEARCH" && e.detail && !r.searches.includes(e.detail)) r.searches.push(e.detail);
      else if (e.type === "CART_ADD" && e.detail) r.cartAdds.push(e.detail);
      else if (e.type === "CHECKOUT_START") r.checkoutStarts++;
      else if (e.type === "ERROR") r.errors.push({ at, page: e.page, detail: e.detail ?? "" });
    }

    const all = [...rows.values()];
    for (const r of all) if (r.firstAt && r.lastAt) r.activeMinutes = Math.round((Date.parse(r.lastAt) - Date.parse(r.firstAt)) / 60_000);
    const byLast = (a: ActivityRow, b: ActivityRow) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
    return {
      registered: all.filter((r) => registeredKeys.has(r.key)).sort((a, b) => byLast(a, b) || (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "")),
      guests: all.filter((r) => !registeredKeys.has(r.key) && r.lastAt).sort(byLast).slice(0, 150),
      ok: true,
    };
  } catch (e) {
    console.error("[activity] okunamadı:", (e as Error).message);
    return { registered: [], guests: [], ok: false };
  }
}
