// yaz ve geri-al betiklerinin ortak akışı: bağlan → hedefi göster → planla → (kuru değilse) EVET onayı → yedek → partili koşullu yazma.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { partilerleUygula, PARTI, yedekIcerigi } from "./cekirdek.mjs";
import { baglan, pgDb } from "./db.mjs";
import { evetSor, KOK } from "./ortam.mjs";

/**
 * planla(urunler) → { planlar, notlar: string[] }. islem: "yaz" | "geri-al". dogrula: partiden sonra ek denetim (isteğe bağlı).
 * Onay sorusundan ÖNCE hiçbir şey yazılmaz. EVET gelmezse çıkılır.
 */
export async function planlaVeUygula({ islem, kuru, planla, dogrula = null, canli = false }) {
  const { client, sunucu, dal, e2e } = await baglan({ canli });
  try {
    console.log(`Veritabanı: sunucu ${sunucu} · dal: ${dal}`);
    const db = pgDb(client);
    const { planlar, notlar } = planla(await db.urunleriOku());
    for (const n of notlar) console.log(n);
    const gorsel = planlar.reduce((n, p) => n + p.yeni.images.length, 0);
    console.log(`${planlar.length} ürün (${gorsel} görsel adresi) ${PARTI}'lik partilerle yazılacak.`);
    if (planlar.length === 0) return;
    if (kuru) {
      for (const p of planlar.slice(0, 10)) console.log(`  ${p.modelCode ?? p.id}: ${p.eski.images[0] ?? "—"} → ${p.yeni.images[0] ?? "—"}`);
      console.log("KURU ÇALIŞTIRMA: veritabanına yazılmadı.");
      return;
    }
    const hedef = e2e ? "e2e-test dalına" : "production'a";
    if (!(await evetSor(`${hedef} yazılacak, devam için EVET yazın:`))) {
      console.log("Onay verilmedi, hiçbir şey yazılmadı.");
      process.exitCode = 1;
      return;
    }
    const tarih = new Date().toISOString().replace(/[:.]/g, "-");
    const yedek = join(KOK, `yedek-${tarih}-${islem}.json`);
    writeFileSync(yedek, JSON.stringify(yedekIcerigi(planlar, { islem, tarih, sunucu }), null, 1));
    console.log(`Yedek (yazmadan önceki değerler): ${yedek}`);
    const ozet = await partilerleUygula(db, planlar, { dogrula, log: console.log });
    console.log(`\nBitti: ${ozet.yazilan} ürün yazıldı, ${ozet.atlanan.length} ürün atlandı (okunduktan sonra değişmiş), ${ozet.varyasyonAtlanan} renk atlandı.`);
    if (ozet.atlanan.length > 0) console.log(`Atlanan ürün kimlikleri: ${ozet.atlanan.join(", ")}\nKomutu yeniden çalıştırınca güncel değerle yeniden denenir.`);
    console.log("Vitrin önbelleği: değişikliğin sitede hemen görünmesi için admin panelde herhangi bir ürünü kaydedin ya da Vercel'de yeniden dağıtın.");
  } finally {
    await client.end().catch(() => {});
  }
}
