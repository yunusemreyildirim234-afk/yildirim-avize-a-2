// GÜVENLİK KİLİDİ: testler yalnızca e2e dalı veritabanına karşı çalışır.
// E2E_DATABASE_URL yoksa durur; bağlanıp public.e2e_marker tablosunu doğrular, yoksa durur.
// Bağlantı dizesi hiçbir hata mesajına/loga yazılmaz.
const { Client } = require("pg");

async function assertE2eDatabase() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error("E2E_DATABASE_URL tanımlı değil (e2e/.env.e2e). Test başlatılmadı.");
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`E2E veritabanına bağlanılamadı (${err && err.code ? err.code : "bağlantı hatası"}). Test başlatılmadı.`);
  }
  try {
    const { rows } = await client.query("select to_regclass('public.e2e_marker') as t");
    if (!rows[0] || rows[0].t === null) {
      throw new Error("Bu veritabanı e2e dalı değil (public.e2e_marker yok), test başlatılmadı.");
    }
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { assertE2eDatabase };
