# Logo envanteri (yeni logo uygulaması)

Eski dosyalar yerinde; yeni dosyalar `-v2` ekiyle (önbellek). Kaynak: `cikti/logo-final/`, üretim: `cikti/logo-final/uygulama/build-uygulama.cjs`.

| Yer | Dosya / referans | Boyut | Durum |
|---|---|---|---|
| Hero | `public/logo-hero-4.png` (Hero.tsx) | 640×298 | önceki işte yenilendi |
| Hero üçgen | `public/logo-uc-gen.png` | 128×65 | önceki işte yenilendi |
| Header | `public/logo-header-4.png` (Navbar.tsx) | 172×80 | önceki işte yenilendi |
| Sekme ikonu | `public/favicon-v2.ico` (16/32/48, harfsiz, şeffaf) + `public/favicon.ico` (aynı; daha önce yoktu) — layout `icons.icon/shortcut` | | değişti |
| PWA/Android | `public/icon-192-v2.png`, `icon-512-v2.png`, manifest.json `icons` | 192, 512 | değişti (opak beyaz, %12 kenar, harfli) |
| Maskable | `public/icon-maskable-512-v2.png` (merkez %56) | 512 | değişti |
| iOS | `public/apple-touch-icon-v2.png` (harfsiz) | 180 | değişti |
| OG | `public/og-v2.png` — layout `openGraph.images` | 1200×630 | değişti (eskisi 1512 kare `logo.png`) |
| Twitter | `public/logo-kare-v2.png` — layout `twitter.images` (card: summary) | 512 | değişti |
| Kategori OG yedeği | `app/kategori/[slug]/page.tsx` `"/logo.png"` → `/og-v2.png` | | değişti |
| JSON-LD | `app/page.tsx` LightingStore'a `logo` eklendi (`logo-kare-v2.png`; öncesinde alan yoktu) | 512 | eklendi |
| E-posta | `public/email-logo-v2.png` (opak beyaz, 400 px, 200 px gösterim) | 400×203 | dosya hazır, bağlanmadı: şablonlar (`lib/email.ts`) metin başlıklı, logo görseli yok; ekleme düzeni değiştirir |
| Admin panel / giriş / hesap / 404 / hata / yükleniyor / footer / kargo-takip / siparis-onay | logo görseli kullanmıyor (metin başlık) | | değişmedi |
| Fatura/fiş/yazdırma, feed (google.xml), Trendyol | logo kullanımı yok | | değişmedi |
| Eskiler (silinmedi) | `logo.png`, `icon-192/512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `logo-ikon/mark/ucgen/hero/header*.png` | | kullanılmıyor |

## Güncelleme: tam logo (-v3) ve denetim

**Tam logo** (kristal + "Yıldırım Avize" + üçgen; mobil hero oranları; `cikti/logo-final/uygulama/build-tam-logo.cjs`):
- `icon-192-v3.png`, `icon-512-v3.png`, `apple-touch-icon-v3.png` (%12 kenar), `icon-maskable-512-v3.png` (tamamı merkez %56'da), `email-logo-v3.png` (400 px, 200 px gösterim). Manifest, layout `icons` ve `lib/email.ts` bunlara geçti. Favicon (`favicon-v2.ico`, yalnız silüet) değişmedi.

**Denetim** (kod, `public/manifest.json`, `llms.txt`, `proxy.ts`, `next.config.ts`, testler):
| Yer | Durum |
|---|---|
| Eski dosyalara (`logo.png`, `logo-mark/ikon/ucgen`, `icon-192/512.png`, `apple-touch-icon.png`, `logo-header*`, `logo-hero*` eski sürümler) giden referans | kalmadı; yalnız `Hero.tsx` (logo-hero-4) ve `Navbar.tsx` (logo-header-4) güncel dosyalara bakıyor |
| `icons` / `openGraph` / `twitter` geçersiz kılma | `icons` yalnız `app/layout.tsx`'te; alt sayfalar (`giris`, `siparis-onay`, `kargo-takip`, `admin`) yalnız title/robots verir, ikonu ezmez. `openGraph` ezen: `kategori/[slug]`, `urun/[id]` (ürün kapağı kullanır; kategori yedeği `og-v2.png`) |
| "Siparişlerim" sekmesindeki eski favicon | Canlı HTML (`/giris`, `/siparis-onay/x`, `/kargo-takip`) yeni `favicon-v2.ico` ve `-v2/-v3` ikonlarını veriyor; sebep tarayıcı favicon önbelleği (sekme eski yüklemeden). Sert yenileme / sekmeyi kapat-aç ile gider |
| Navbar masaüstü/mobil | tek logo `<Image>` (172×80, `h-9 sm:h-10 w-auto`), kırpma yok (`overflow`/`object-cover` yok; header h-16/sm:h-20). Menü çekmecesinde logo yok |
| Footer, yükleniyor/hata/404, admin üst çubuğu, giriş | logo görseli kullanmıyor |
| `logo-kare-v2.png` (JSON-LD + twitter) | harfsiz değil, kristal+harfli kare; tam logoya çevrilmedi (istenmedi) |
