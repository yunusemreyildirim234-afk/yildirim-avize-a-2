// Trendyol görsellerini indirir, WebP'ye çevirir ve Vercel Blob'a yazar. VERİTABANINA YAZMAZ (yalnızca okur).
//   npm run kopyala -- --ornek 10 --dry-run   → hiçbir şey yüklemez; cikti/onizleme.html üretir (npm run onizleme ile aynı)
//   npm run kopyala -- --ornek 10             → ilk 10 uygun ürünü yükler
//   npm run kopyala -- --urun 5,17 --tuval oran
//   npm run kopyala                           → kalan tüm görseller
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { argumanlar, bekleyenler, GUVENLI_SINIR, HOBBY_LIMIT, blobMu, kaynakHash, kotaDurumu, sec, urunKaynaklari } from "./lib/cekirdek.mjs";
import { baglan, pgDb } from "./lib/db.mjs";
import { blobIstemcisi, indir } from "./lib/blob.mjs";
import { isle, orijinalKucuk } from "./lib/gorsel.mjs";
import { kopyala } from "./lib/kopya.mjs";
import { onizlemeHtml } from "./lib/onizleme-html.mjs";
import { calistir, CIKTI, evetSor, manifestOku, manifestYaz, ortamYukle } from "./lib/ortam.mjs";

async function urunleriOku() {
  const { client, sunucu, dal } = await baglan();
  console.log(`Veritabanı (YALNIZCA OKUMA): sunucu ${sunucu} · dal: ${dal}`);
  try {
    return await pgDb(client).urunleriOku();
  } finally {
    await client.end().catch(() => {});
  }
}

/** Kuru çalıştırma: indirir, seçili tuvalde (--tuval, varsayılan kare) v2 çıktısını üretir, cikti/onizleme.html yazar. Blob'a ve veritabanına dokunmaz. */
async function onizle(secili, tuval) {
  const dizin = join(CIKTI, "onizleme");
  mkdirSync(dizin, { recursive: true });
  const kaydet = (ad, buf) => {
    writeFileSync(join(dizin, ad), buf);
    return `onizleme/${ad}`;
  };
  const urunler = [];
  let n = 0;
  for (const u of secili) {
    const gorseller = [];
    const ters = new Map(Object.entries(u.imageMap ?? {}));
    for (const url of urunKaynaklari(u)) {
      const h = kaynakHash(url);
      try {
        const buf = await indir(url);
        const s = await isle(buf, [tuval]);
        const c = s.ciktilar[tuval];
        // ÖNCE: ürün şu an v1 (ya da başka) Blob görseli tutuyorsa onun küçük (-k) sürümü
        const v1 = ters.get(url);
        let once = null;
        if (blobMu(v1)) once = await indir(v1.replace(/-b.webp$/, "-k.webp")).then((b) => ({ dosya: kaydet(`${h}-once.webp`, b) })).catch(() => null);
        gorseller.push({ url, orijinal: kaydet(`${h}-orijinal.webp`, await orijinalKucuk(buf)), orijinalBayt: buf.length, kaynak: s.kaynak, kutu: s.kutu, durum: s.durum, dolgu: s.dolgu, once, tuval, sonra: { dosya: kaydet(`${h}-v2-${tuval}.webp`, c.k), w: c.w, h: c.h, baytB: c.b.length, baytK: c.k.length } });
      } catch (e) {
        gorseller.push({ url, hata: e instanceof Error ? e.message : String(e) });
      }
      n++;
    }
    urunler.push({ modelCode: u.modelCode, title: u.title, gorseller });
    console.log(`  ${u.modelCode ?? "—"} · ${u.title}: ${gorseller.length} görsel`);
  }
  const dosya = join(CIKTI, "onizleme.html");
  writeFileSync(dosya, onizlemeHtml(urunler));
  console.log(`\nKURU ÇALIŞTIRMA: ${secili.length} ürün, ${n} görsel işlendi. Hiçbir şey yüklenmedi, veritabanına yazılmadı.\nÖnizleme: ${dosya}`);
}

export async function ana(argv) {
  const a = argumanlar(argv);
  ortamYukle();
  const urunler = await urunleriOku();
  const secili = sec(urunler, a, (u) => urunKaynaklari(u).length > 0);
  if (secili.length === 0) return console.log("Kopyalanacak Trendyol görseli olan ürün yok.");
  if (a.dryRun) return onizle(secili, a.tuval);

  const manifest = manifestOku();
  const is = bekleyenler(secili, manifest, a.tuval);
  if (is.length === 0) return console.log(`Seçili ${secili.length} ürünün tüm görselleri zaten kopyalanmış (--tuval ${a.tuval}).`);
  const k = kotaDurumu(manifest, is.length * 2);
  console.log(`${secili.length} ürün, ${is.length} görsel (--tuval ${a.tuval}).`);
  console.log(`${k.planlanan} yazma yapılacak, aylık Hobby sınırı (${HOBBY_LIMIT}) göz önüne alındığında ${k.kalan} kaldı (bu ay ${k.kullanilan} kullanıldı; bu koşudan sonra ${k.sonraKalan} kalır).`);
  if (k.asar) {
    if (!a.siniriAs) throw new Error(`Bu ayki toplam yazma ${k.kullanilan + k.planlanan} olur ve güvenli sınırı (${GUVENLI_SINIR}) aşar. Durduruldu. Daha az ürün seçin (--ornek / --urun) ya da --siniri-as ekleyin.`);
    if (!(await evetSor(`UYARI: güvenli sınır (${GUVENLI_SINIR}) AŞILACAK; Hobby sınırı (${HOBBY_LIMIT}) geçilirse Blob deposu ay sonuna kadar kilitlenebilir. Devam için EVET yazın:`))) throw new Error("Onay verilmedi, çıkıldı.");
  }
  const blob = blobIstemcisi();
  const sonuc = await kopyala({ is, manifest, tuval: a.tuval, blob, indir, isle, kaydet: () => manifestYaz(manifest), log: console.log });
  manifestYaz(manifest);
  console.log(`\nBitti: ${sonuc.tamam} görsel kopyalandı, ${sonuc.hatalar.length} hata. Bu ay toplam yazma: ${kotaDurumu(manifest, 0).kullanilan}.`);
  for (const h of sonuc.hatalar.slice(0, 20)) console.log(`  HATA ${h.url}: ${h.hata}`);
  if (sonuc.hatalar.length > 0) {
    console.log("Hatalı görseller atlandı; komutu yeniden çalıştırınca yalnızca kalanlar denenir.");
    process.exitCode = 1;
  } else console.log("Veritabanı henüz DEĞİŞMEDİ. Adresleri yazmak için: npm run yaz");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) calistir(() => ana(process.argv.slice(2)));
