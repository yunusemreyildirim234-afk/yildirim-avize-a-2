// Neon e2e dalını uyanık tutar: 60 sn'de bir YALNIZCA "select 1"; hiçbir şey yazmaz, URL/gizli değer yazdırmaz; en çok 40 dk çalışıp çıkar.
// Başlangıçta safety.cjs güvenlik kilidi AYNEN çalışır (E2E_DATABASE_URL yoksa ya da public.e2e_marker yoksa hemen durur).
// Kullanım (e2e klasöründe): node scripts/keepalive.cjs
const { Client } = require("pg");
const { loadE2eEnv } = require("../env.cjs");
const { assertE2eDatabase } = require("../safety.cjs");

const INTERVAL_MS = 60_000;
const MAX_MS = 40 * 60_000;
const MAX_FAILS = 5;

async function ping() {
  const c = new Client({ connectionString: process.env.E2E_DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    await c.connect();
    await c.query("select 1");
  } finally {
    await c.end().catch(() => {});
  }
}

async function main() {
  loadE2eEnv();
  await assertE2eDatabase();
  const started = Date.now();
  let fails = 0;
  console.log("[keepalive] başladı (60 sn aralık, en çok 40 dk)");
  while (Date.now() - started < MAX_MS) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    try {
      await ping();
      fails = 0;
    } catch {
      if (++fails >= MAX_FAILS) throw new Error("üst üste bağlantı hatası");
    }
  }
  console.log("[keepalive] süre doldu, çıkılıyor");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`[keepalive] durdu: ${err.message}`);
    process.exit(1);
  }
);
