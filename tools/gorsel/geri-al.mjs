// Blob adreslerini eski Trendyol adreslerine geri çevirir (Product.syncSnapshot.imageMap tersinden).
// Blob dosyalarını ve imageMap'i SİLMEZ: `npm run yaz` yeniden yükleme yapmadan tekrar ileri taşır. CANLIYA YAZAR: EVET onayı ister.
//   npm run geri-al -- --ornek 10 --dry-run
//   npm run geri-al -- --ornek 10      → ilk 10 taşınmış ürün (yaz --ornek 10 ile aynı sıra)
//   npm run geri-al -- --urun 5,17
//   npm run geri-al                    → taşınmış tüm ürünler
import { argumanlar, geriAlPlani, sec } from "./lib/cekirdek.mjs";
import { calistir, ortamYukle } from "./lib/ortam.mjs";
import { planlaVeUygula } from "./lib/yazici.mjs";

calistir(async () => {
  const a = argumanlar(process.argv.slice(2));
  ortamYukle();
  await planlaVeUygula({
    islem: "geri-al",
    canli: a.canli,
    kuru: a.dryRun,
    planla(urunler) {
      const planlar = sec(urunler, a, (u) => geriAlPlani(u) !== null).map((u) => geriAlPlani(u));
      return { planlar, notlar: ["Geri alma: Blob adresleri eski Trendyol adreslerine döner; Blob dosyaları ve imageMap silinmez."] };
    },
  });
});
