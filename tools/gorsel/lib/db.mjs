// PostgreSQL erişimi (pg). Bağlantı dizesi hiçbir mesaja/loga yazılmaz; yalnızca sunucu adı gösterilir.
import pg from "pg";

const DENEME = 4;
const BEKLE_MS = 3000;

/** Bağlantı dizesinden YALNIZCA sunucu adı (kullanıcı, parola, veritabanı adı yok). */
export function sunucuAdi(url) {
  try {
    return new URL(url).hostname || "bilinmiyor";
  } catch {
    return "bilinmiyor";
  }
}

/** GORSEL_DATABASE_URL varsa o, yoksa DATABASE_URL. Neon uykudaysa bağlantı birkaç kez denenir. */
export async function baglan() {
  const url = process.env.GORSEL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil (kök .env / .env.local ya da tools/gorsel/.env).");
  let kod = "bağlantı hatası";
  for (let i = 1; i <= DENEME; i++) {
    const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
    try {
      await c.connect();
      const { rows } = await c.query("select to_regclass('public.e2e_marker') as t");
      const e2e = rows[0]?.t != null;
      return { client: c, sunucu: sunucuAdi(url), e2e, dal: e2e ? "e2e-test (public.e2e_marker var)" : "e2e_marker yok: PRODUCTION kabul edilir" };
    } catch (e) {
      kod = e?.code ?? "bağlantı hatası";
      await c.end().catch(() => {});
      if (i < DENEME) await new Promise((r) => setTimeout(r, BEKLE_MS));
    }
  }
  throw new Error(`Veritabanına bağlanılamadı (${kod}, ${DENEME} deneme).`);
}

const OBJE = (ifade) => `(CASE WHEN jsonb_typeof(${ifade}) = 'object' THEN ${ifade} ELSE '{}'::jsonb END)`;

const OKU = `
SELECT p.id, p."modelCode", p.title, p.category, p.images, p."imageUrl",
       ${OBJE(`p."syncSnapshot"->'imageMap'`)} AS "imageMap",
       COALESCE((SELECT json_agg(json_build_object('id', v.id, 'images', v.images) ORDER BY v.position, v.id)
                 FROM "ProductVariation" v WHERE v."productId" = p.id), '[]'::json) AS variations
FROM "Product" p`;

// Koşullu yazma: satır hâlâ okunan (eski) değerdeyse. imageMap, syncSnapshot'ın diğer alanlarına dokunmadan birleştirilir.
const URUN_YAZ = `
UPDATE "Product" SET images = $2::text[], "imageUrl" = $3::text,
  "syncSnapshot" = CASE WHEN $6::jsonb IS NULL THEN "syncSnapshot"
    ELSE ${OBJE(`"syncSnapshot"`)} || jsonb_build_object('imageMap', ${OBJE(`"syncSnapshot"->'imageMap'`)} || $6::jsonb) END
WHERE id = $1 AND images = $4::text[] AND "imageUrl" IS NOT DISTINCT FROM $5::text`;

const VARYASYON_YAZ = `UPDATE "ProductVariation" SET images = $2::text[] WHERE id = $1 AND "productId" = $4 AND images = $3::text[]`;

export function pgDb(client) {
  return {
    async urunleriOku(ids) {
      if (ids && ids.length === 0) return [];
      const { rows } = ids ? await client.query(`${OKU} WHERE p.id = ANY($1::text[])`, [ids]) : await client.query(OKU);
      return rows;
    },
    /** Tek transaction: ürün koşullu yazılır; yazılamadıysa (arada değişmiş) renkleri de atlanır. Hata olursa tüm parti geri alınır. */
    async partiYaz(planlar) {
      const sonuc = [];
      await client.query("BEGIN");
      try {
        for (const p of planlar) {
          const r = await client.query(URUN_YAZ, [p.id, p.yeni.images, p.yeni.imageUrl, p.eski.images, p.eski.imageUrl, p.imageMapEk ? JSON.stringify(p.imageMapEk) : null]);
          const yazildi = r.rowCount === 1;
          let varyasyonAtlanan = 0;
          if (yazildi) {
            for (const v of p.varyasyonlar) {
              const vr = await client.query(VARYASYON_YAZ, [v.id, v.yeni, v.eski, p.id]);
              if (vr.rowCount !== 1) varyasyonAtlanan++;
            }
          }
          sonuc.push({ id: p.id, yazildi, varyasyonAtlanan });
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      }
      return sonuc;
    },
  };
}
