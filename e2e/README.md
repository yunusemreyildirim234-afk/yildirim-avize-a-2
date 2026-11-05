# e2e (Playwright) — Aşama 1: herkese açık sayfalar ve güvenlik

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
npm test              # masaüstü (1280x800) + mobil (390x844), HTML rapor üretir
npm run test:desktop
npm run test:mobile
npm run report        # playwright-report/ klasörünü açar
```

- Varsayılan: kök projede `next build` + `next start -p 3100` (üretim derlemesi).
- Zaten çalışan yerel sunucu için: `E2E_BASE_URL=http://localhost:3100 npm test` (yalnızca localhost kabul edilir).
- Sunucu ortamında `DATABASE_URL = E2E_DATABASE_URL`; Resend, PayTR, Kargonomi, CRON anahtarları **boş**:
  e-posta gönderimi hata günlüğü yazıp atlanır, PayTR/Kargonomi istek atmadan hata fırlatır, cron uçları 401 döner.

## Güvenlik ilkeleri

- Aşama 1 salt okunurdur: sipariş, kayıt, form gönderimi yoktur. `/api/events` (DB'ye yazar) testlerde 204 ile taklit edilir.
- Tarayıcı dış alanlara gidemez; GTM/GA ve Trendyol CDN görselleri yerel taslakla karşılanır (testler çevrimdışı geçer).
- `.env.e2e` içeriği hiçbir yerde okunup yazdırılmaz.
- Build kök `.next` klasörünü paylaşır (`next.config.ts` değiştirilemez).
