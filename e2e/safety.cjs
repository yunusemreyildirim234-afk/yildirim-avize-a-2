// GÜVENLİK KİLİDİ: testler yalnızca e2e dalı veritabanına karşı çalışır.
// E2E_DATABASE_URL yoksa durur; bağlanıp public.e2e_marker tablosunu doğrular, yoksa durur.
// Bağlantı dizesi hiçbir hata mesajına/loga yazılmaz.
const { Client } = require("pg");

const CONNECT_ATTEMPTS = 4;
const RETRY_WAIT_MS = 3000;

async function assertE2eDatabase() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error("E2E_DATABASE_URL tanımlı değil (e2e/.env.e2e). Test başlatılmadı.");
  }
  // Neon uyku halinden ilk bağlantı kurulamayabilir: YALNIZCA bağlantı hatası yeniden denenir
  // (en çok 4 deneme, her biri 15 sn zaman aşımı, aralarda 3 sn). Adres/tablo kontrolleri yeniden denenmez.
  let client = null;
  let lastCode = "bağlantı hatası";
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS && !client; attempt++) {
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 15000 });
    try {
      await c.connect();
      client = c;
    } catch (err) {
      lastCode = err && err.code ? err.code : "bağlantı hatası";
      await c.end().catch(() => {});
      if (attempt < CONNECT_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
    }
  }
  if (!client) {
    throw new Error(`E2E veritabanına bağlanılamadı (${lastCode}, ${CONNECT_ATTEMPTS} deneme). Test başlatılmadı.`);
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
