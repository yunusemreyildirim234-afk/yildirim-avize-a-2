import { normalizeEmail } from "./unsubscribe-token.ts";

// Onay yazımının saf mantığı (alias içermez; birim testte sahte veritabanıyla çalışır).
export interface ConsentDb {
  marketingConsent: {
    findUnique(args: { where: { email: string }; select: { unsubscribedAt: true } }): Promise<{ unsubscribedAt: Date | null } | null>;
    create(args: { data: { email: string; consentedAt: Date; source: string; textVersion: string; ip: string | null; userAgent: string | null } }): Promise<unknown>;
    upsert(args: {
      where: { email: string };
      create: { email: string; consentedAt: Date; source: string; textVersion: string; ip: string | null; userAgent: string | null };
      update: { consentedAt: Date; unsubscribedAt: null; textVersion: string; ip: string | null; userAgent: string | null };
    }): Promise<unknown>;
  };
}

export interface ConsentOpts {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  source?: string;
  textVersion: string;
  /** false: yalnızca kayıt yoksa oluşturur; abonelikten çıkmış veya mevcut kayda dokunmaz. Varsayılan true (açık kullanıcı eylemi). */
  reactivate?: boolean;
}

export async function writeConsent(db: ConsentDb, opts: ConsentOpts): Promise<void> {
  const email = normalizeEmail(opts.email);
  const now = new Date();
  const meta = { textVersion: opts.textVersion, ip: opts.ip?.slice(0, 64) ?? null, userAgent: opts.userAgent?.slice(0, 300) ?? null };
  const source = opts.source ?? "sepet";
  if (opts.reactivate === false) {
    const row = await db.marketingConsent.findUnique({ where: { email }, select: { unsubscribedAt: true } });
    if (!row) await db.marketingConsent.create({ data: { email, consentedAt: now, source, ...meta } });
    return;
  }
  await db.marketingConsent.upsert({
    where: { email },
    create: { email, consentedAt: now, source, ...meta },
    update: { consentedAt: now, unsubscribedAt: null, ...meta },
  });
}
