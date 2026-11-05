import { Pool, type PoolClient } from "pg";

// e2e veritabanına doğrudan erişim (yalnızca yönetim arayüzünün sunmadığı durumlar için: pasife alma, vitrin kuponu bağlama, bildirim üretme, ayar geri yükleme).
// Her bağlantıdan önce güvenlik kilidi (public.e2e_marker) doğrulanır; kilit geçmezse hiçbir sorgu çalışmaz. Bağlantı dizesi yazdırılmaz.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertE2eDatabase } = require("./safety.cjs") as { assertE2eDatabase: () => Promise<void> };

let locked: Promise<void> | null = null;

// Kilit AYNEN uygulanır; yalnızca ağ kaynaklı bağlantı hatasında (uzak veritabanı soğuk başlangıcı) birkaç kez yeniden denenir.
// "e2e dalı değil" gibi gerçek ret nedenleri hemen fırlatılır ve asla yeniden denenmez.
async function lock(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      return await assertE2eDatabase();
    } catch (err) {
      if (i >= 3 || !/bağlanılamadı/.test((err as Error).message)) throw err;
    }
  }
}

let pool: Pool | null = null;

/** Tek bağlantı havuzu (işçi başına): uzak veritabanına her sorguda yeniden bağlanma maliyeti ve ağ kesintisi riski azalır. */
export async function db<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  locked ??= lock();
  await locked;
  pool ??= new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 20_000 });
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    let c: PoolClient;
    try {
      c = await pool.connect();
    } catch (err) {
      lastErr = err; // ağ kaynaklı bağlantı hatası: yeniden dene
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    try {
      return await fn(c);
    } finally {
      c.release();
    }
  }
  throw lastErr;
}

export const rows = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> => db(async (c) => (await c.query(sql, params)).rows as R[]);
export const exec = async (sql: string, params: unknown[] = []): Promise<void> => void (await db((c) => c.query(sql, params)));

export async function productIdByTitle(title: string): Promise<string | null> {
  const r = await rows<{ id: string }>(`select id from "Product" where title = $1`, [title]);
  return r[0]?.id ?? null;
}
