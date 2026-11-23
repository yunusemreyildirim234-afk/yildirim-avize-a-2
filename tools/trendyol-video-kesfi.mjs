// Trendyol ürün listesi alan keşfi — video alanı araması (yerel, salt okuma).
// Ne yapar: ürün listeleme ucundan (lib/trendyol.ts ile aynı istek) İLK sayfayı (en çok 20 ürün) bir kez GET eder ve
// yanıtın yalnız ALAN YOLLARINI ve değer TİPLERİNİ yazdırır. Değer yazdırılmaz (kimlik, ad, telefon, e-posta, adres dahil).
// Adında video / mp4 / media / youtube geçen alanlar "[VIDEO?]" ile işaretlenir; değeri video adresine benziyorsa
// yalnız alan yolu + adresin ALAN ADI (host) ve uzantısı gösterilir, tam adres ASLA yazılmaz.
// Token/başlık/ham yanıt yazılmaz ve hiçbir dosyaya kaydedilmez. Hata durumunda yalnız HTTP durum kodu yazılır.
// Çalıştırma (proje kökünde): node --env-file=.env tools/trendyol-video-kesfi.mjs
// Ortam: TRENDYOL_SUPPLIER_ID ve (TRENDYOL_TOKEN veya TRENDYOL_API_KEY + TRENDYOL_API_SECRET).

import { pathToFileURL } from "node:url";

const BASE = "https://apigw.trendyol.com/integration/product/sellers";
const MAX_ITEMS = 20;
const TIMEOUT_MS = 15_000;
const VIDEO_KEY = /(video|mp4|media|youtube)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m3u8|avi|mkv)(?:$|[?#])/i;
const VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i;

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** Adında video ipucu geçen alan adı mı? */
export const isVideoKey = (key) => VIDEO_KEY.test(String(key));

/** Değer video adresine benziyorsa { host, ext } döner (tam adres dönmez); değilse null. */
export function videoHint(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return null;
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    return { host: "<çözümlenemedi>", ext: "-" };
  }
  const ext = (value.match(VIDEO_EXT)?.[1] ?? "").toLowerCase();
  return ext || VIDEO_HOST.test(host) ? { host, ext: ext || "-" } : null;
}

/**
 * Ürün listesini düzleştirir: her benzersiz yol bir kez, "yol: tip" biçiminde.
 * Video ipucu taşıyan alan "[VIDEO?]" alır; adres benzeri değerde yalnız "alan adı=…, uzantı=…" eklenir.
 * Değer (metin, sayı, kimlik vb.) hiçbir koşulda yazılmaz. Diziler `[]`, sayısal anahtarlar `{n}` olur.
 */
export function describeItems(items) {
  const seen = new Map();
  const add = (path, v, key) => {
    const t = typeOf(v);
    const hint = videoHint(v);
    const flagged = isVideoKey(key) || isVideoKey(path) || hint !== null;
    let line = `${path}: ${t}`;
    if (flagged) line += " [VIDEO?]";
    if (hint) line += ` (alan adı=${hint.host}, uzantı=${hint.ext})`;
    const id = `${path}|${t}|${hint ? hint.host + hint.ext : ""}`;
    if (!seen.has(id)) seen.set(id, line);
  };
  const walk = (v, path, key) => {
    if (Array.isArray(v)) {
      add(path, v, key);
      for (const item of v) walk(item, `${path}[]`, key);
    } else if (v && typeof v === "object") {
      add(path, v, key);
      for (const [k, val] of Object.entries(v)) walk(val, `${path}.${/^\d+$/.test(k) ? "{n}" : k}`, k);
    } else {
      add(path, v, key);
    }
  };
  (Array.isArray(items) ? items.slice(0, MAX_ITEMS) : []).forEach((it) => walk(it, "content[]", ""));
  return [...seen.values()];
}

function credentials(env = process.env) {
  const supplierId = env.TRENDYOL_SUPPLIER_ID;
  const token = env.TRENDYOL_TOKEN || (env.TRENDYOL_API_KEY && env.TRENDYOL_API_SECRET ? Buffer.from(`${env.TRENDYOL_API_KEY}:${env.TRENDYOL_API_SECRET}`).toString("base64") : "");
  return { supplierId, token };
}

async function main() {
  let { supplierId, token } = credentials();
  if (!supplierId || !token) {
    try {
      process.loadEnvFile(".env"); // --env-file verilmediyse .env'i kendisi yükler
    } catch {
      /* .env yok */
    }
    ({ supplierId, token } = credentials());
  }
  if (!supplierId || !token) {
    console.error("Trendyol kimlik bilgisi tanımlı değil (TRENDYOL_SUPPLIER_ID ve TRENDYOL_TOKEN veya TRENDYOL_API_KEY/TRENDYOL_API_SECRET).");
    process.exit(1);
  }
  let res;
  try {
    res = await fetch(`${BASE}/${supplierId}/products?page=0&size=${MAX_ITEMS}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Basic ${token}`, "User-Agent": `${supplierId} - SelfIntegration`, Accept: "application/json" },
    });
  } catch {
    console.error("Ağ hatası veya zaman aşımı.");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    process.exit(1);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    console.error("Yanıt JSON değil.");
    process.exit(1);
  }
  const lines = describeItems(json?.content);
  console.log(`=== Ürün listesi alan yolları (en çok ${MAX_ITEMS} ürün; değer yazdırılmaz) ===`);
  for (const l of lines) console.log(l);
  const flagged = lines.filter((l) => l.includes("[VIDEO?]"));
  console.log(`\n=== Video ipucu taşıyan alanlar: ${flagged.length} ===`);
  for (const l of flagged) console.log(l);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
