// Yetim Blob ADAY raporu. YALNIZ OKUR: Blob'u listeler, veritabanını salt okunur sorgular, cikti/ altına rapor dosyası yazar.
// Hiçbir Blob dosyasını değiştirmez, taşımaz, kaldırmaz. Canlı veritabanı için --canli gerekir (varsayılan: GORSEL_DATABASE_URL).
//   npm run yetim                 (deneme dalı)      npm run yetim -- --canli --gun 30
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { list } from "@vercel/blob";
import { baglan } from "./lib/db.mjs";
import { CIKTI, KOK, calistir, ortamYukle } from "./lib/ortam.mjs";
import { YAS_GUN, analizEt, csvUret, envanterTopla, ozetMetni } from "./lib/yetim-cekirdek.mjs";
import { yetimDb } from "./lib/yetim-db.mjs";
import { dosyaReferanslari } from "./lib/yetim-dosya.mjs";

/** Gerçek Blob envanteri (yalnız list). Token ortamdan okunur, yazdırılmaz. */
export function blobListeIstemcisi() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN tanımlı değil (kök .env.local ya da tools/gorsel/.env).");
  return { liste: ({ cursor }) => list({ cursor, limit: 1000, token }) };
}

/** Test edilebilir ana akış: bağımlılıklar dışarıdan verilir. */
export async function ana({ blob, db, dosyaYollari, simdi = new Date(), yasGun = YAS_GUN, yaz = null }) {
  const bloblar = await envanterTopla(blob);
  const dbYollari = await db.referansYollari();
  const urunIdleri = await db.urunKimlikleri();
  // Rapor yazılmadan hemen önce referanslar ikinci kez okunur (arada eklenen referans adayı düşürür)
  const dbYollari2 = await db.referansYollari();
  const sonuc = analizEt({ bloblar, dbYollari, dbYollari2, dosyaYollari, urunIdleri, simdi, yasGun });
  if (yaz) yaz(sonuc, simdi);
  return sonuc;
}

function raporYaz(sonuc, simdi) {
  mkdirSync(CIKTI, { recursive: true });
  const damga = simdi.toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(CIKTI, `yetim-${damga}.json`), JSON.stringify(sonuc, null, 1));
  writeFileSync(join(CIKTI, `yetim-${damga}.csv`), csvUret(sonuc.satirlar));
  console.log(`Rapor: tools/gorsel/cikti/yetim-${damga}.json ve .csv`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) komut();

function komut() {
  calistir(async () => {
    ortamYukle();
    const arg = process.argv.slice(2);
    const canli = arg.includes("--canli");
    const gi = arg.indexOf("--gun");
    const yasGun = gi >= 0 ? Number(arg[gi + 1]) : YAS_GUN;
    if (!Number.isFinite(yasGun) || yasGun < 1) throw new Error("--gun pozitif bir sayı olmalı.");
    const { client, sunucu, dal } = await baglan({ canli });
    try {
      console.log(`Veritabanı: ${sunucu} · ${dal} · yalnız okuma`);
      const sonuc = await ana({ blob: blobListeIstemcisi(), db: yetimDb(client), dosyaYollari: dosyaReferanslari(join(KOK, "..", ".."), KOK), yasGun, yaz: raporYaz });
      console.log(ozetMetni(sonuc.ozet));
      console.log("Sınıflar:", JSON.stringify(sonuc.ozet.siniflar));
      console.log("Hiçbir dosya silinmedi/değiştirilmedi. Adayları silmeden önce raporu elle gözden geçirin.");
    } finally {
      await client.end().catch(() => {});
    }
  });
}
