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
| `GORSEL_DATABASE_URL` | `tools/gorsel/.env` | varsayılan hedef (ör. deneme dalı). Yoksa betikler DURUR; canlı için komuta `--canli` eklenir |

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
`--canli` (canlı `DATABASE_URL`'ye bağlanmaya izin verir; `GORSEL_DATABASE_URL` yoksa şart), `--tuval kare|oran` (varsayılan `kare`; `kopyala` ve `yaz` AYNI değerle çalıştırılmalı), `--dry-run`, `--siniri-as` (yalnızca `kopyala`).

## Nasıl çalışır

- **Karar (v2): ürünün hiçbir pikseli kesilmez.** Tüm görseller KARE tuvale konur. Kırpma yalnızca Trendyol'un eklediği DÜZ BEYAZ
  şeritleri (her kanal ≥253) atar ve yalnızca fotoğrafın kendi zemini belirgin biçimde beyaz DEĞİLSE yapılır:
  - Zemin gri/renkli (kenar halkası medyanı, en koyu kanalda <215) ve şerit tek eksendeyse: yalnızca düz beyaz şeritler atılır, **pay eklenmez**.
  - Zemin beyaz/açık/saydam (kristal, cam, abajur), **belirsiz** (≥215) ya da şerit iki eksendeyse (ürün sınırı): **hiç kırpılmaz**.
  - **Dolgu** (kırpılan alan kare değilse; fotoğraf bütün halde ortalanır, pikselleri BİREBİR korunur):
    - en/boy oranı 1 ± %3: dolgu yok (kenar pikseli birkaç px uzatılır);
    - kutu kenarları ≥245 (beyaz/açık): saf beyaz dolgu;
    - değilse: aynı fotoğrafın kareyi dolduracak büyütülmüş, güçlü bulanıklaştırılmış hâli (bulanık arka plan); fotoğraf kenarının hemen dışında
      kenar pikseli uzatması ~%1,5 genişlikte yumuşakça bulanığa geçer (dikiş görünmez). Tek renkli zeminde sonuç zaten düz renge yakındır.
  Önizlemede her görsel için "Kırpıldı / Kırpılmadı" ve "dolgu: beyaz / bulanık arka plan" etiketi ile dikiş kontrolü için büyük bir örnek görünür.
- **Tuval:** `kare` (varsayılan) = yukarıdaki kare tuval; `oran` = tuval yok, aynı güvenli kırpma, oran korunur.
- **Boyutlar:** her görselden iki dosya: `...-b.webp` (en çok 1600 px; veritabanına bu yazılır) ve `...-k.webp` (en çok 800 px;
  site `lib/img.ts` ile türetir).
- **Blob yolu belirlenimci ve sürümlü:** `urun/<ürün kimliği>/<kaynak adresin özeti>-<kr|or>-v2-<b|k>.webp`; üzerine yazma kapalı.
  Eski v1 dosyaları (`...-kr-b.webp`) SİLİNMEZ. Manifestte v2 kayıtları `kare-v2` / `oran-v2` anahtarındadır; v1 kayıtları durur.
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

## v1 → v2 yeniden yükleme (kare tuval)

Daha önce v1 ile taşınmış ürünlerin Trendyol kaynağı `syncSnapshot.imageMap` ile bulunur. `kopyala` v2 dosyalarını YENİ yola yükler,
`yaz` ürün adreslerini v2'ye çevirir (imageMap v2 ile güncellenir). `geri-al` yine eski Trendyol adreslerine döner.

```
npm run onizleme -- --ornek 10             # kuru: önce (v1 canlı) / sonra (v2) yan yana; hiçbir şey yüklenmez
npm run onizleme -- --urun 12,34,56        # belirli model kodları
npm run kopyala  -- --ornek 10             # 10 ürünü v2 olarak Blob'a yükler (veritabanı DEĞİŞMEZ)
npm run yaz      -- --ornek 10 --dry-run   # ne yazılacağını gösterir
npm run yaz      -- --ornek 10             # veritabanını v2 adreslerine çevirir (EVET ister)
npm run kopyala                            # kalan tüm ürünler
npm run yaz
```

**Kota (Vercel Blob Hobby, aylık 2000 yazma; güvenli sınır 1800):** görsel başına 2 yazma (büyük + küçük). Bu ay şu an 66 yazma kullanıldı.
10 ürünü yeniden yüklemek +66 → 132. 226 ürün ≈ +1188 → toplam ≈ **1320** (2000 altında). `kopyala` başlamadan planlanan yazmayı ve
kalan hakkı yazar; 1800'ü aşacaksa durur. Gerçek kullanım Vercel panelindedir.

## Test edilmeyen kısım

`lib/db.mjs` içindeki SQL ve `lib/blob.mjs` içindeki gerçek Blob çağrıları hiçbir veritabanına/depoya karşı çalıştırılmadı
(testler sahte veritabanı ve sahte Blob kullanır). İlk gerçek doğrulama `onizleme` (yalnızca okur) ve 10 ürünlük örnektir.
