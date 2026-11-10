// Ortam değişkenleri, onay sorusu, manifest dosyası. Gizli değerler (bağlantı dizesi, token) HİÇBİR yere yazdırılmaz.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { bosManifest } from "./cekirdek.mjs";

export const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CIKTI = join(KOK, "cikti");
const MANIFEST = join(CIKTI, "manifest.json");

/** Öncelik sırası: tools/gorsel/.env → kök .env.local → kök .env (önce yüklenen kazanır; tanımlı değişken ezilmez). */
export function ortamYukle() {
  for (const f of [join(KOK, ".env"), join(KOK, "..", "..", ".env.local"), join(KOK, "..", "..", ".env")]) {
    if (existsSync(f)) process.loadEnvFile(f);
  }
}

/** Yalnızca tam olarak EVET yazılırsa true. Etkileşimsiz ortamda (girdi yok) false. */
export async function evetSor(soru) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ac = new AbortController();
    rl.once("close", () => ac.abort());
    return (await rl.question(`${soru} `, { signal: ac.signal })).trim() === "EVET";
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

export function manifestOku() {
  if (!existsSync(MANIFEST)) return bosManifest();
  return { ...bosManifest(), ...JSON.parse(readFileSync(MANIFEST, "utf8")) };
}

/** Atomik yazma (geçici dosya + yeniden adlandırma): yarıda kesilen koşu manifesti bozmaz. */
export function manifestYaz(m) {
  mkdirSync(CIKTI, { recursive: true });
  const gecici = `${MANIFEST}.tmp`;
  writeFileSync(gecici, JSON.stringify(m, null, 1));
  renameSync(gecici, MANIFEST);
}

/** Betiklerin ortak hata çıkışı: yalnızca mesaj yazdırılır (yığın izi ve nesne dökümü yok). */
export function calistir(ana) {
  ana().catch((e) => {
    console.error(`HATA: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
