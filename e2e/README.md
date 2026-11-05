# e2e (Playwright) — Aşama 1: herkese açık sayfalar ve güvenlik; Aşama 2: yönetim paneli; Aşama 3: havale siparişi

Kök projeden bağımsız alt projedir (kendi `package.json`). Kök bağımlılıklar değişmez.

## Kurulum

```
cd e2e
npm install
npx playwright install chromium
copy .env.e2e.example .env.e2e     # sonra E2E_DATABASE_URL değerini doldur
```

`E2E_DATABASE_URL`, **yalnızca e2e dalına** işaret etmeli ve içinde `public.e2e_marker` tablosu olmalı
(ör. `create table public.e2e_marker (id int);`). Aksi halde test başlamaz:
`bu veritabanı e2e dalı değil, test başlatılmadı`.

## Çalıştırma

```
npm test              # hepsi: masaüstü + mobil (herkese açık) sonra admin; HTML rapor üretir
npm run test:desktop  # yalnızca herkese açık testler, 1280x800
npm run test:mobile   # yalnızca herkese açık testler, 390x844
npm run test:admin    # yalnızca yönetim paneli (giriş kurulumu + admin testleri + kalıntı denetimi)
npm run test:orders   # yalnızca havale sipariş akışı (giriş kurulumu + sipariş testleri + kalıntı denetimi)
npm run report        # playwright-report/ klasörünü açar
```

- Varsayılan: kök projede `next build` + `next start -p 3100` (üretim derlemesi).
- Zaten çalışan yerel sunucu için: `E2E_BASE_URL=http://localhost:3100 npm test` (yalnızca localhost kabul edilir).
- Sunucu ortamında `DATABASE_URL = E2E_DATABASE_URL`; Resend, PayTR, Kargonomi, CRON anahtarları **boş**:
  e-posta gönderimi hata günlüğü yazıp atlanır, PayTR/Kargonomi istek atmadan hata fırlatır, cron uçları 401 döner.

## Aşama 2: yönetim paneli (admin) testleri

Dosyalar `tests/admin/` altındadır: `i-login`, `j-product`, `k-colors`, `l-category`, `m-homepage`, `n-coupon`, `o-notification` (+ `setup.ts`, `audit.ts`).
Yardımcılar: `admin-helpers.ts` (PNG üretici, form doldurma, temizlik), `db.ts` (kilitli pg erişimi).

### Admin oturumu nasıl kuruluyor

1. `playwright.config.ts` her çalıştırmada **rastgele** bir yönetici parolası üretir (`crypto.randomBytes`) ve kullanıcı adı `e2e-admin` olarak sabittir.
   Bunlar yalnızca (a) e2e sunucusunun ortamına `ADMIN_USER` / `ADMIN_PASSWORD` olarak, (b) test işçilerine `E2E_ADMIN_USER` / `E2E_ADMIN_PASSWORD` olarak verilir. Diske yazılmaz, loglanmaz.
2. `tests/admin/setup.ts` (proje `admin-setup`) **gerçek giriş akışını** çalıştırır: `/giris?tab=yonetici` formu → `POST /api/auth/admin` → `ya_admin` çerezi.
   Oturum `e2e/.auth/admin.json` dosyasına `storageState` olarak kaydedilir (git'e girmez); `admin` projesi bunu yeniden kullanır, hiçbir testte yeniden giriş yapılmaz.
3. Gerçek üretim sırları (`.env`, Vercel) kullanılmaz ve okunmaz. Site kodunda hiçbir değişiklik yoktur.
   `.env`'deki `ADMIN_USER/ADMIN_PASSWORD` e2e sunucusunda üzerine yazılır; veritabanındaki `ADMIN` rollü hesaplar için 2FA kodu e-postayla gelir ve e-posta kapalı olduğundan o yol kullanılmaz.
4. Yazan testler **yalnızca** `admin` projesinde, `workers: 1` ile, herkese açık testlerden sonra sırayla çalışır (paylaşılan veritabanı).
   Çıkış testi ayrı bir bağlamda yeniden giriş yapar (storageState oturumuna dokunmaz).

### Veri güvenliği

- Her yazan test kendi verisini `E2E ` önekiyle oluşturur ve `afterAll` / `finally` içinde siler (yönetim API'si üzerinden, arayüzün çağırdığı uçlarla).
  Ortak ayarlar (ana sayfa ayarı, gizlenen kategori, vitrin kuponu bağı) önce okunur, sonda aynen geri yüklenir ve eşitlik doğrulanır.
- Arayüzün sunmadığı üç durum için `db.ts` ile doğrudan pg yazması yapılır (her bağlantıdan önce `e2e_marker` kilidi doğrulanır): ürünü pasife alma/aktifleştirme, vitrin kuponunu bağlama, sentetik yönetici bildirimi ekleme. Hepsi test sonunda geri alınır.
- `audit.ts` (proje `admin-audit`, `admin-setup`'ın **teardown**'u): tüm admin testlerinden sonra, salt okunur işlemde (`BEGIN READ ONLY`) `E2E ` önekli ürün / kupon / bildirim / kategori-ayar kalıntısını arar; varsa adlarıyla birlikte testi başarısız sayar. Silme/yazma yapmaz.
- Sipariş oluşturma ve e-posta gönderen yollar Aşama 2'de test edilmez.

### Bilgi: vitrin önbelleği ve geç görünürlük

Yönetici işlemleri `revalidateTag("storefront","max")` çağırır; bu "eskiyi sun, arkada yenile" davranışıdır: değişiklikten hemen sonraki ilk istek eski veriyi görebilir.
Testler vitrin durumunu bu yüzden `expect.poll` ile (en çok 30 sn) yoklar.

## Aşama 3: havale siparişi akışı

Dosyalar `tests/orders/` altındadır: `p-siparis.spec.ts` (sıralı, veri üretir), `q-dogrulama.spec.ts` (sipariş oluşmaz). Yardımcılar: `order-helpers.ts`.
Proje `orders`: yalnızca masaüstü, `workers: 1`, herkese açık testlerden sonra, yönetici `storageState`'iyle; müşteri tarafı ayrı, oturumsuz bir bağlamda çalışır.

- **Kartlı ödeme test edilmez**: PayTR'ye hiç istek gitmez. Kargonomi il/ilçe uçları (anahtarsız 502) yalnızca müşteri bağlamında `page.route` ile sabit yanıtlarla taklit edilir. Resend anahtarı boştur; e-posta gönderilemese de sipariş başarılı olmalıdır (doğrulanır).
- **Hız sınırı**: `/api/order` bellek içi 10 dk'da 5 istek sınırı başarısız istekleri de sayar. Bir koşuda en çok 4 istek ulaşır (ana sipariş, kuponlu sipariş, kupon limit ret çağrısı, stok siparişi). Doğrulama testleri `/api/order`'ı tarayıcıda taklit eder; sunucuya gitmez. Aynı sunucu sürecinde 10 dk içinde ikinci koşu hız sınırına takılır (yeni `npm test` yeni süreç başlatır).
- **Veri**: yönetim arayüzüyle "E2E Sipariş" önekli iki ürün (stok 5 / stok 2) ve API ile kişi başı limitli "E2EKUPON…" kuponu; müşteriler `e2e-siparis@example.invalid`, `e2e-siparis2@example.invalid`, `e2e-siparis3@example.invalid` (açıkça sahte). `afterAll`: sipariş/bildirim/misafir kullanıcı (yalnızca bu e-postalar), sonra ürünler, sonra kupon silinir.
- **Kalıntı denetimi** (`admin/audit.ts`, yalnızca SELECT) sahte e-postalı kullanıcı, sipariş ve bildirim kalıntısını da arar.
- **Bulgular** (siteye dokunulmaz) `test.fail` ile işaretlidir; site düzeltilince test "beklenmedik geçti" diye uyarır: stok tükenince ürün sayfası önbelleği yenilenmiyor. Ayrıca `/siparis-onay/<id>` sahiplik kontrolü yapmaz (kimlik bilen görür) ve var olmayan kimlikte HTTP 200 ile 404 içeriği döner (annotation olarak raporlanır).

## Güvenlik ilkeleri

- Aşama 1 (herkese açık testler) salt okunurdur: sipariş, kayıt, form gönderimi yoktur. `/api/events` (DB'ye yazar) testlerde 204 ile taklit edilir.
- Tarayıcı dış alanlara gidemez; GTM/GA ve Trendyol CDN görselleri yerel taslakla karşılanır (testler çevrimdışı geçer).
- `.env.e2e` içeriği hiçbir yerde okunup yazdırılmaz.
- Build kök `.next` klasörünü paylaşır (`next.config.ts` değiştirilemez).
