// Kopyalanmış görsellerin Blob adreslerini veritabanına yazar (Product.images, imageUrl, renk görselleri).
// Eski Trendyol adresleri Product.syncSnapshot.imageMap içinde saklanır (geri-al bunu kullanır). CANLIYA YAZAR: EVET onayı ister.
//   npm run yaz -- --ornek 10 --dry-run   → yalnızca ne yazılacağını gösterir
//   npm run yaz -- --ornek 10             → ilk 10 hazır ürün
//   npm run yaz                           → kopyası tamam olan tüm ürünler
// --tuval, kopyala'da kullanılanla AYNI olmalı (varsayılan kare).
import { argumanlar, sec, urunKaynaklari, yazPlani } from "./lib/cekirdek.mjs";
import { kapaklariDogrula } from "./lib/blob.mjs";
import { calistir, manifestOku, ortamYukle } from "./lib/ortam.mjs";
import { planlaVeUygula } from "./lib/yazici.mjs";

calistir(async () => {
  const a = argumanlar(process.argv.slice(2));
  ortamYukle();
  const manifest = manifestOku();
  await planlaVeUygula({
    islem: "yaz",
    kuru: a.dryRun,
    dogrula: kapaklariDogrula,
    planla(urunler) {
      const hazir = (u) => yazPlani(u, manifest, a.tuval).plan !== null;
      const adaylar = sec(urunler, { urun: a.urun, ornek: null }, (u) => urunKaynaklari(u).length > 0);
      const eksik = adaylar.filter((u) => yazPlani(u, manifest, a.tuval).eksik > 0);
      const planlar = sec(adaylar, { urun: null, ornek: a.ornek }, hazir).map((u) => yazPlani(u, manifest, a.tuval).plan);
      const notlar = [`Trendyol görseli olan ${adaylar.length} ürün bulundu (--tuval ${a.tuval}).`];
      if (eksik.length > 0) notlar.push(`${eksik.length} ürünün kopyası eksik, YAZILMAYACAK (önce npm run kopyala): ${eksik.slice(0, 15).map((u) => u.modelCode ?? u.id).join(", ")}${eksik.length > 15 ? " ..." : ""}`);
      return { planlar, notlar };
    },
  });
});
