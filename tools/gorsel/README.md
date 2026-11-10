# tools/gorsel — ürün görsellerini Vercel Blob'a kopyalama

Kök projeden bağımsız alt projedir (kendi `package.json`; köke bağımlılık eklenmez, Vercel derlemesine girmez).
Trendyol (`cdn.dsmcdn.com`) görsellerini indirir, beyaz kenarı kırpar, WebP'ye çevirir, Vercel Blob'a yazar ve
`Product.images` / `imageUrl` / renk görsellerini yeni adreslerle değiştirir. Yalnızca yerelde, elle çalıştırılır.

## Ortam değişkenleri

Betikler şu dosyaları bu öncelikle okur (önce bulunan kazanır): `tools/gorsel/.env` → kök `.env.local` → kök `.env`.

| Değişken | Nerede | Kim kullanır |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | kök `.env.local` | `kopyala` (kuru çalıştırma istemez) |
| `DATABASE_URL` | kökte zaten var | hepsi (`onizleme`/`kopyala` yalnızca okur) |
| `GORSEL_DATABASE_URL` | isteğe bağlı, `tools/gorsel/.env` | varsa `DATABASE_URL` yerine kullanılır (ör. deneme dalı) |

Değerler hiçbir çıktıya yazdırılmaz; veritabanı için yalnızca sunucu adı ve dal bilgisi gösterilir.
Dal bilgisi `public.e2e_marker` tablosuna bakar: varsa `e2e-test`, yoksa **production** kabul edilir
(Neon dal adı bağlantı dizesinde yoktur; sunucu adındaki `ep-...` kimliğini Neon panelindeki dalla karşılaştırın).

## Komutlar

```
npm install
npm test                                  # sahte veritabanı + sahte Blob; ağa çıkmaz
npm run onizleme -- --ornek 10            # kuru: cikti/onizleme.html (hiçbir şey yüklenmez/yazılmaz)
npm run kopyala  -- --ornek 10            # Blob'a yükler (veritabanı DEĞİŞMEZ)
npm run yaz      -- --ornek 10 --dry-run  # ne yazılacağını gösterir
npm run yaz      -- --ornek 10            # veritabanına yazar (EVET onayı ister)
npm run geri-al  -- --ornek 10            # eski Trendyol adreslerine döner (EVET onayı ister)
```

Bayraklar: `--ornek N` (model koduna göre ilk N uygun ürün; üç betikte aynı sıra), `--urun 5,17,42` (model kodları),
`--tuval kare|oran` (varsayılan `kare`; `kopyala` ve `yaz` AYNI değerle çalıştırılmalı), `--dry-run`, `--siniri-as` (yalnızca `kopyala`).

## Nasıl çalışır

- **Kırpma:** yalnızca dört köşesi beyaza yakın görseller kırpılır; kırpılan kutunun çevresine orijinal görselden %6 pay geri eklenir.
  Ortam fotoğraflarına dokunulmaz. Ürün çok küçük kalacaksa kırpma atlanır ve önizlemede turuncu rozetle işaretlenir.
- **Tuval:** `kare` = kırpılan ürün zemin renginde kare tuvale ortalanır; `oran` = yalnızca kırpılır.
- **Boyutlar:** her görselden iki dosya: `...-b.webp` (en çok 1600 px; veritabanına bu yazılır) ve `...-k.webp` (en çok 800 px;
  site `lib/img.ts` ile türetir).
- **Blob yolu belirlenimci:** `urun/<ürün kimliği>/<kaynak adresin özeti>-<kr|or>-<b|k>.webp`; üzerine yazma kapalı.
- **Devam edilebilir:** durum `cikti/manifest.json` içindedir. Yeniden çalıştırınca bitenler atlanır. **Bu dosyayı silmeyin.**
- **Kota:** her Blob yazma denemesi manifestte aylık sayılır. `kopyala` başlamadan kalan hakkı yazar; ayın toplamı 1800'ü aşacaksa durur
  (`--siniri-as` + EVET ile aşılabilir). Sayaç yalnızca bu betiğin yazmalarını bilir; gerçek kullanım Vercel panelindedir.
- **Yazma:** 20'lik partiler, parti başına tek transaction. Her satır **koşullu** yazılır (okunan eski değer hâlâ duruyorsa); arada
  admin panelden değişen ürün atlanır. Tüm görselleri kopyalanmamış ürün hiç yazılmaz. Her partiden sonra satırlar geri okunur ve
  yeni kapak adresleri `HEAD` ile denenir; uyuşmazlıkta durur.
- **Eski adresler:** `Product.syncSnapshot.imageMap` (`{ "<Trendyol>": "<Blob>" }`) ve yazmadan önce `yedek-<tarih>-yaz.json`.
- **Geri alma:** `imageMap` tersinden uygulanır; `imageMap` ve Blob dosyaları silinmez, `yaz` yeniden yükleme yapmadan tekrar ileri taşır.
- **Trendyol eşitlemesi:** `lib/trendyol-sync.ts` gelen görselleri `imageMap` ile çevirir; "Ezerek" modunda bile kopyalar geri ezilmez.
  `yaz`/`geri-al` çalışırken admin panelden eşitleme başlatmayın.
- **Yeni Trendyol ürünleri:** eşitlemeden sonra `npm run kopyala` ve `npm run yaz` yeniden çalıştırılır; yalnızca yeni görseller işlenir.
  Admin paneldeki "N görsel henüz kopyalanmadı" uyarısı bunu hatırlatır.

## Test edilmeyen kısım

`lib/db.mjs` içindeki SQL ve `lib/blob.mjs` içindeki gerçek Blob çağrıları hiçbir veritabanına/depoya karşı çalıştırılmadı
(testler sahte veritabanı ve sahte Blob kullanır). İlk gerçek doğrulama `onizleme` (yalnızca okur) ve 10 ürünlük örnektir.
