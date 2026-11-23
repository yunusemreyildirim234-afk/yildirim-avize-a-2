# Ürün videosu — tasarım notu (TASLAK, kod yok)

Durum: yalnız plan. Şema, kod ve SQL çalıştırması sahibin onayıyla, aşağıdaki sırayla yapılır.

## 1. Kapsam

- Ürün başına **tek** video adresi (`Product.videoUrl`, nullable `TEXT`).
- Desteklenen biçimler: YouTube bağlantısı, Vimeo bağlantısı, doğrudan `.mp4` adresi.
- Varyasyon (renk) başına video yok; ürün düzeyinde tek video.
- Video dosyası yüklenmez; yalnız adres saklanır.

## 2. Videoyu Neon'a (veritabanına) neden koymuyoruz

- Neon depolama ve veri aktarımı kotalıdır; bir video onlarca MB'dır, tek ürün fotoğrafının yüzlerce katı. Yedek, dal (branch) kopyası ve `e2e-test` dalı da şişer.
- Veritabanı satırı bellekten okunur; büyük ikili veri bağlantı havuzunu ve sorgu süresini bozar (ürün sorguları zaten dar `select` ile tutuluyor).
- Video akışı (aralıklı okuma, kalite seçimi, önbellek) veritabanının işi değildir; YouTube/Vimeo veya bir nesne depolama bunu hazır sunar.
- Vercel Functions Storage sınırı: büyük yanıtlar işlevden geçirilmemeli.
- Sonuç: yalnız **adres** saklanır (birkaç yüz bayt). Dosyayı barındırmak istersek ayrı iş: Vercel Blob (görseller zaten orada) veya YouTube'a yükleme.

## 3. İzin verilen alan adları ve doğrulama kuralı

Sunucuda (admin kaydetme ucu) ve istemcide **aynı saf fonksiyon** (`lib/video-url.ts`, yeni dosya) kullanılır; sunucu kararı esastır.

İzin verilen ana makineler (tam eşleşme veya alt alan adı):

| Tür | Ana makine | Biçim |
| --- | --- | --- |
| YouTube | `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `youtube-nocookie.com` | `watch?v=ID`, `youtu.be/ID`, `shorts/ID`, `embed/ID` → 11 karakterlik ID çıkarılır |
| Vimeo | `vimeo.com`, `player.vimeo.com` | `vimeo.com/123456789` → sayısal ID çıkarılır |
| Doğrudan dosya | `*.public.blob.vercel-storage.com` (kendi Blob'umuz) ve sahibin onayladığı ek alan adları (`lib/video-url.ts` içinde sabit liste) | yol `.mp4` ile biter |

Kurallar:

1. Yalnız `https:` kabul edilir (`http:`, `javascript:`, `data:`, `blob:` reddedilir).
2. `new URL()` ile çözümlenir; kullanıcı adı/parola (`user:pass@`) içeren adres reddedilir.
3. Ana makine izin listesinde değilse reddedilir (açık yönlendirme / izleme adresi riski).
4. Uzunluk en çok 500 karakter; boşluklar kırpılır; boş dizge = video yok (`null`).
5. YouTube/Vimeo adresi **kanonik biçime** çevrilip saklanır (ör. `https://www.youtube.com/watch?v=ID`, `https://vimeo.com/ID`); fazladan sorgu parametreleri (izleme: `si`, `utm_*`, `t` hariç) atılır. Gösterimde yalnız ID'den üretilen gömme adresi kullanılır, kullanıcı metni doğrudan `src`'e girmez.
6. `.mp4` adresinde sorgu/parça (`?`, `#`) yalnız imzalı Blob adresleri için kabul edilir; aksi halde atılır.
7. Hata iletileri sayfa içinde açık Türkçe ("Yalnız YouTube, Vimeo veya .mp4 bağlantısı eklenebilir.").

Testler (ileride): geçerli/geçersiz adres tablosu, `javascript:` ve `//evil.test` denemeleri, kanonikleştirme, uzunluk sınırı.

## 4. Ürün sayfasında gösterim

- Galeride fotoğrafların yanında bir **video küçük resmi** (oynat simgeli, `lucide-react` `Play`); ayrı sekme yerine galeri şeridinin son öğesi. Ürün fotoğrafı başrol kalır; video ilk açılışta seçili olmaz.
- **Tembel yükleme (cephe/facade):** sayfa ilk yüklenirken hiçbir video betiği, iframe veya oynatıcı yüklenmez. YouTube için küçük resim `https://i.ytimg.com/vi/ID/hqdefault.jpg` (veya hiç dış istek istemiyorsak yalnız simgeli düz kutu); kullanıcı **Oynat**'a basınca iframe (`youtube-nocookie.com/embed/ID`, `loading="lazy"`, `allow` asgari) oluşturulur. `.mp4` için `<video preload="none" controls playsinline>` ve `poster` yok/ürün kapağı.
- Klavye ile gezinme ve `focus-visible`, düğmede `aria-label="Ürün videosunu oynat"`, iframe'e `title`.
- Video yoksa hiçbir şey çizilmez; galeri bugünkü gibi kalır.
- LCP/CLS: kutu galeriyle aynı oranda (aspect-ratio) ayrılır.
- Çerez/izleme: `youtube-nocookie.com` kullanılır; çerez çubuğuna dokunulmaz.
- **CSP:** `next.config.ts` şu an `Content-Security-Policy-Report-Only` ve `frame-src` yalnız PayTR/Google'a açık. Yayına geçmeden önce `frame-src`'e `https://www.youtube-nocookie.com https://player.vimeo.com`, `media-src`'e Blob alan adı, `img-src`'e `https://i.ytimg.com` eklenmesi gerekir. `next.config.ts` korunan dosyadır → **sahibin açık izni** gerekir (ayrı iş).

## 5. Admin ürün düzenleyicide "Video" bölümü

- Ürün düzenleyicide görsel bölümünün altında **"Video"** başlığı; sayfa içi arayüz, yerel `confirm/alert/prompt` yok.
- Durumlar:
  - Video yok: tek satır girdi ("YouTube, Vimeo veya .mp4 bağlantısı") + **Ekle** düğmesi.
  - Video var: küçük önizleme (cephe), kanonik adres, **Değiştir** (girdiyi açar) ve **Sil**.
  - **Sil:** sayfa içi iki adımlı onay (düğme "Silmek için tekrar bas" durumuna geçer ve 5 sn sonra geri döner); kayıt `videoUrl = null`.
- Kaydetme mevcut ürün PATCH ucu üzerinden (`verifyAdminSession` zorunlu, `lib/admin-product-patch.ts` içinde yeni alan beyaz listeye eklenir); doğrulama bölüm 3'teki fonksiyonla.
- Hareket günlüğüne ("etkinlik") eski → yeni adres düşer (yalnız alan adı + ID, tam sorgu parametreleri değil).
- Geri alma: mevcut "geri al" akışı (varsa) alanı kapsar; yoksa tek alanlık eski değer saklanır.

## 6. Trendyol'dan çekme akışı

Önkoşul: Trendyol ürün yanıtında video alanı olup olmadığı **bilinmiyor**. Önce `tools/trendyol-video-kesfi.mjs` sahibin makinesinde çalıştırılır (`node --env-file=.env tools/trendyol-video-kesfi.mjs`): yalnız alan yolları/tipleri ve video ipucu taşıyan alanların yolu + adres alan adı/uzantısı yazılır. Çıktıya göre karar:

- Alan **yoksa:** Trendyol'dan çekme yapılmaz; yalnız elle ekleme kalır.
- Alan **varsa:** mevcut Trendyol eşitleme önizlemesi (plan → önizleme → uygula) genişletilir:
  1. Önizlemede **"Video bulunan ürünler"** ayrı bir liste olarak gösterilir (ürün adı, adresin alan adı ve uzantısı).
  2. Varsayılan **seçili değil**; sahip hangi ürünlere video alınacağını işaretler ve onaylar. Otomatik toplu yazma yok.
  3. Bölüm 3'ün doğrulaması uygulanır; izin listesinde olmayan adresler "atlandı" olarak gösterilir.
  4. Elle girilmiş video, Trendyol'dan gelen değerle sessizce ezilmez: `syncSnapshot` mantığı gibi elle değişiklik tespiti (var olan video + farklı gelen adres = çakışma satırı).
- Trendyol'dan gelen bir adresin hangi alan adında olduğu ve kalıcılığı/erişim kuralı keşif çıktısına göre belli olur; izin listesine eklenmesi ayrı bir sahip kararıdır.

## 7. Telif ve kullanım şartı uyarısı

- Trendyol'daki video, Trendyol'un veya satıcının (bizim ya da marka/üretici) malı olabilir. Başkasına ait videoyu izinsiz yeniden göstermek telif ihlalidir; Trendyol kullanım şartları da içeriğin başka sitede kullanımını kısıtlayabilir.
- Yalnız **bize ait** veya yayın izni olan videolar eklenmeli. YouTube/Vimeo gömme, ilgili platformun gömme şartlarına tabidir (videonun gömmeye açık olması gerekir).
- Admin arayüzünde Video bölümünde kısa uyarı: "Yalnız yayın hakkı sizde olan videoları ekleyin."
- Trendyol'dan çekmede sahibin onayı zorunlu (bölüm 6, madde 2); toplu otomatik içe aktarma yapılmaz.

## 8. `Product.videoUrl` alanının etkileri

Şema: `prisma/schema.prisma` → `videoUrl String?` (korunan dosya; yalnız bu dar nullable eklemeye **sahip izni** gerekir). Sıra: **önce** `prisma/sql/video-url-ekle.sql` production'da çalışır, **sonra** şema ve kod.

Sorgular ve select'ler:

- **Ürün sayfası** (`app/urun/[id]`, `lib/products.ts` içindeki tekil ürün sorgusu): `videoUrl` select'e eklenir; yalnız burada gerekir.
- **Kart/liste** (`CARD_SELECT`, `CARD_LIST_SELECT`, `lib/products.ts`): **eklenmez** (kartta video yok; vitrin yükü artmaz).
- **Arama, sepet, benzer ürünler, tamamlayıcı öneriler, sipariş kalemi ürünü** (`lib/complement-suggestions.ts`, `lib/cart-products.ts`, `lib/order-item-product.ts`, `lib/order-confirmation.ts`): eklenmez.
- **Admin liste dar select'i** (`ADMIN_LIST_PRODUCT_SELECT`, `lib/admin-product-list.ts`; `tests/admin-liste-dar-select.test.mjs` bu listeyi sınar): liste video göstermez → **eklenmez**; testin "dar kalır" beklentisi bozulmaz. Düzenleyici tek ürün sorgusuyla `videoUrl`'i ayrı okur.
- **Admin düzenleyici ürün okuma/yazma** (`app/api/admin/product/route.ts`, `lib/admin-product-patch.ts`): `videoUrl` okunur ve PATCH beyaz listesine eklenir.
- **Trendyol eşitleme** (`lib/trendyol-sync.ts` `select`, `lib/trendyol-plan.ts` `PRODUCT_FIELDS`): yalnız bölüm 6'daki onaylı akışa girerse; aksi halde eşitleme `videoUrl`'e dokunmaz.
- **Önbellek:** vitrin `unstable_cache` etiketleri (`lib/storefront-cache-key.ts`, `lib/revalidate.ts`) mevcut; ürün sayfası videoyu içerdiği için admin kaydında mevcut `revalidateStorefront` çağrısı yeterli. Ürün sayfası önbellek anahtarına yeni alan eklemek gerekmez (anahtar ürün kimliği/sürüm).
- **SEO/yapılandırılmış veri:** ileride `VideoObject` JSON-LD değerlendirilebilir (ayrı iş; YouTube için küçük resim/süre bilgisi gerekir).
- **Testler (ileride):** doğrulama tablosu, PATCH beyaz listesi, kart select'inde `videoUrl` olmadığı, admin liste select'inin dar kaldığı, Trendyol keşif betiği (hazır).

## 9. Uygulama sırası (öneri)

1. Sahip `tools/trendyol-video-kesfi.mjs` çıktısını paylaşır (Trendyol akışı için karar).
2. Sahip `prisma/sql/video-url-ekle.sql` dosyasını production'da çalıştırır (`e2e-test` dalı silindi; sahip geçici/test dalı açarsa önce orada).
3. Şema satırı (`videoUrl String?`) + `lib/video-url.ts` + testler.
4. Admin düzenleyici "Video" bölümü + PATCH.
5. Ürün sayfası galeri/tembel oynatıcı.
6. CSP genişletmesi (`next.config.ts`, sahip izniyle) ve — karar verildiyse — Trendyol'dan çekme.


> Trendyol'dan çekme kapsam dışı bırakıldı (sahip kararı, 24 Kasım 2026); yalnız elle ekleme.
