// Yetim aracının YALNIZ OKUYAN veritabanı katmanı. Her sorgu salt okunur işlem içinde çalışır; işlem hep geri alınır.
// Tablo/sütun listesi elle yazılmaz: public şemasındaki tüm metin/json/dizi sütunları information_schema'dan keşfedilir.
// Çıktıya yalnız Blob ADRESLERİ ve ürün kimlikleri alınır (satır içeriği, kişisel veri okunup saklanmaz).
import { ADRES_DESENI, adresYolu } from "./yetim-cekirdek.mjs";

const SUTUNLAR = `
SELECT c.table_name AS tablo, c.column_name AS sutun
FROM information_schema.columns c
JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
WHERE c.table_schema = 'public'
  AND (c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
       OR (c.data_type = 'ARRAY' AND c.udt_name IN ('_text', '_varchar', '_json', '_jsonb')))
ORDER BY c.table_name, c.column_name`;

const tirnak = (ad) => `"${String(ad).replace(/"/g, '""')}"`;

/** Tek sütundaki tüm Blob adresleri (yalnız eşleşen adres metni döner). Desen parametredir; SQL'e yapıştırılmaz. */
export const adresSorgusu = (tablo, sutun) => `SELECT DISTINCT m[1] AS adres FROM ${tirnak(tablo)}, regexp_matches(${tirnak(sutun)}::text, $1, 'g') AS m`;

/** client: pg.Client benzeri ({ query(sql, params) }). Sahte istemciyle de çalışır. */
export function yetimDb(client) {
  async function saltOkunur(is) {
    await client.query("BEGIN TRANSACTION READ ONLY");
    try {
      return await is();
    } finally {
      await client.query("ROLLBACK").catch(() => {});
    }
  }
  return {
    /** Veritabanında geçen Blob yolları (tüm uygun sütunlar). */
    referansYollari: () =>
      saltOkunur(async () => {
        const { rows: sutunlar } = await client.query(SUTUNLAR);
        const yollar = new Set();
        for (const s of sutunlar) {
          const { rows } = await client.query(adresSorgusu(s.tablo, s.sutun), [`(${ADRES_DESENI})`]);
          for (const r of rows) {
            const y = adresYolu(r.adres);
            if (y) yollar.add(y);
          }
        }
        return yollar;
      }),
    /** Product.id değerleri (yalnız kimlik). */
    urunKimlikleri: () =>
      saltOkunur(async () => {
        const { rows } = await client.query(`SELECT id FROM "Product"`);
        return new Set(rows.map((r) => r.id));
      }),
  };
}
