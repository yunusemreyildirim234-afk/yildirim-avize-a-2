# Yıldırım Avize (yildirimavize.com.tr) — Proje Geliştirme & Mimari Yönergeleri



## 1. İletişim ve Kodlama Felsefesi (Cave Man + Ponytail + Karpathy Modu)

- Boş nezaket cümleleri ve uzun açıklamalar yapma; doğrudan çözüme ve koda odaklan.

- **Ponytail & Karpathy Prensibi:** Fazla kod yazma, en sade ve standart çözümü seç. Projeye yeni NPM paketi/kütüphane ekleme; mevcut yapıyı (Vanilla TS + Next.js + Tailwind) kullan.

- Kodu parça parça değil, ilgili dosyanın neresine geleceğini net belirterek uygula.



## 2. Teknoloji Yığını (Tech Stack)

- **Framework:** Next.js (App Router) + TypeScript (Strict mode, `any` yasak)

- **Veritabanı:** Prisma ORM + PostgreSQL (Neon)

- **Stil & İkon:** Tailwind CSS + `lucide-react`

- **Ödeme & Kargo & Mail:** PayTR (Canlı Mod), Kargonomi (Aras Kargo - ID: 4), Resend API



## 3. Çalışma Disiplini (Superpowers Modu)

- Büyük değişikliklerden önce kısa bir uygulama planı çıkar, küçük işlerde doğrudan uygula.

- Bir hata çıktığında tahmin yürütmek yerine kök nedeni analiz et; çalışan yapıları bozmadan yalnızca hedeflenen bileşeni güncelle.

- Stok, kupon ve sipariş durumu değişen işlemler atomik olmalı (`stockDeducted` kontrolü ve Prisma transaction).

- Webhook ve ödeme akışları her zaman idempotent kalmalı.

- Her aşama sonunda mutlaka `npx tsc --noEmit` ve `npm run build` çalıştırarak sıfır hata doğrula.

- Stok tutma süresi (`RESERVATION_HOLD`) her zaman PayTR `timeout_limit` değerinden büyük olmalı; ikisi `lib/stock-rules.ts` içinde tek yerden türer.

- Bir iş tek push ile bitirilir, her bölüm ayrı commit olur (Vercel Functions Storage sınırı).

- Kod ve testler canlı veritabanına yazmaz, dış servise istek atmaz, `.env` okunmaz. **TEK İSTİSNA:** kullanıcı açıkça isterse VE admin oturumunu kendisi açtıysa, yerleşik tarayıcı panelinde canlı admin paneli üzerinden işlem yapılabilir. Bu durumda:
  - (a) Okuma serbesttir.
  - (b) Her yazma işleminden önce ne yapacağını tek cümleyle yaz, uygula, sonra eski → yeni değeri raporla ve `CANLI_ISLEM_GUNLUGU.md`'ye tarih/saat ile ekle.
  - (c) Sipariş durumu değişikliği, ürün silme, fiyat/stok/kupon değişikliği ve toplu işlemlerde işlemden ÖNCE onay sor.
  - (d) Admin şifresi sohbete/dosyaya yazılmaz; kullanıcı panelde kendisi girer.
  - (e) Ödeme (PayTR) ve iade işlemleri hiçbir koşulda tarayıcıdan yapılmaz.

- Commit edilmemiş değişiklikleri etkileyen git komutları yasak: `git stash`, `git reset --hard`, `git checkout -- <dosya>`, `git clean`, `git restore`. Önce/sonra karşılaştırması gerekiyorsa `git worktree` veya dosya kopyası kullan. Commit edilmemiş dosya varsa önce sor.
- Bu git komutları `.claude/settings.json` içindeki `permissions.deny` kurallarıyla da teknik olarak engellenir.

- Tarama/rapor/ilerleme/tasarım notları (`*_RAPORU*.md`, `GENEL_TARAMA_ILERLEME.md`, `PRISMA8_HAZIRLIK.md`, `TRENDYOL_TASARIM.md`) commit edilmez, `.gitignore` ile dışarıda tutulur. Commit'e her zaman dosya adıyla ekle; `git add -A` / `git add .` kullanma.



## 4. UI/UX & Tasarım Prensipleri (Impeccable — Anti-AI Tasarım)

- **Marka Kimliği:** Yarım asırlık Beyoğlu/Şişhane kristal ve modern avize mağazası. Premium, sıcak (amber/gold/stone/zinc tonları), güven veren kurumsal görünüm.

- **Anti-AI Kuralı:** Klasik yapay zeka şablonlarından (mor/mavi neon gradyanlar, aşırı parlak ucuz blur efektleri, rastgele yuvarlatılmış kutular) kesinlikle kaçın.

- **Tipografi & Boşluk:** Net tipografi hiyerarşisi, okunabilir satır yükseklikleri, tutarlı padding/margin ritmi ve kusursuz mobil uyumluluk (mobile-first).

- **Görsel Odak:** Ürün fotoğrafları her zaman başrolde olmalı; animasyonlar abartılmadan mikro etkileşim düzeyinde tutulmalı.

- **Erişilebilirlik:** Yüksek renk kontrastı, anlamlı `alt` metinleri, klavye ile gezinme (`focus-visible`) ve net form hata mesajları.



## 5. Dokunulmaz Alanlar ve Kesin İş Kuralları

- **Ödeme & Kargo:** `/api/paytr/callback`, `/api/paytr/token` ve `lib/kargonomi.ts` içindeki çalışan ödeme/kargo mantığına kesinlikle dokunma.

- **Güvenlik & Ortam:** `proxy.ts` admin korumasına (`verifyAdminSession`) dokunma. `.env` dosyalarını okuma, değiştirme veya loglama.

- **Dokunulmaz Dosyalar:** `lib/orders.ts` (yalnızca açıkça izin verilen ekleme), `lib/pricing.ts`, `lib/cart-pricing.ts`, `lib/session.ts`, `lib/admin-session.ts`, `app/api/order/route.ts` (yalnızca açıkça izin verilen kayıt öncesi kontroller), `next.config.ts`, `prisma/schema.prisma` (yalnızca açıkça izin verilen dar nullable ekleme).

- **İletişim & Yasal:** WhatsApp ürün sorma / destek butonlarına ve çerez çubuğuna dokunma.

- **Banka Alıcı Adı:** `lib/site.ts` içindeki Kuveyt Türk alıcı adı (`holder: "Ömer Yıldırım Ömer Yıldırım"`) resmi banka hesap adı olduğu için çift yazılmaktadır; hata sanıp düzeltme.

- **İndirim & Kargo Sabitleri:** 350 TL üzeri ücretsiz kargo. Varsayılan %5 Havale/EFT ve %3 Beyoğlu mağazadan teslim indirimi; ürün bazında geçersiz kılınabilir (`Product.couponAllowed`, `pickupDiscountPct`, `transferDiscountPct`). Kuponlar yüzde veya TL olabilir; minimum sepet ve kişi başı limiti vardır. Toplam indirim üst sınırı `SiteConfig.maxTotalDiscountPct` (boş = sınırsız), ürün bazlı uygulanır ve adet kademesini kısmaz. Adet kademesi aynı ürünün tüm renklerinin toplam adedine göre uygulanır. Fiyat hesabı tek yerde: `lib/cart-pricing.ts` (`priceCart`); `/api/order`, `/api/cart/quote`, sepet ve vitrin bunu kullanır. Ürünler birleştirilmiş (montajlı) gönderilir; evin tavanına montaj hizmeti yoktur (yalnızca WhatsApp uzaktan teknik destek vardır). SMS bildirimi yoktur (yalnızca e-posta).
- **Kargo & Teslimat:** Aras Kargo ile gönderilir. Ürün sayfalarında, listelerde, SSS'de, e-postalarda ve meta açıklamalarında "sigortalı" ifadesi kullanılmaz. Hukuki metinlerdeki (ön bilgilendirme, mesafeli satış sözleşmesi, iade/cayma sayfası) mevcut "sigortalı" ifadeleri olduğu gibi kalır; onlara dokunma.

- **ETBİS & Kurumsal Bilgiler:** Site `.tr` uzantılı (`www.yildirimavize.com.tr`) olduğu için yeni mevzuat gereği ETBİS karekod zorunluluğu yoktur; ETBİS alanı genel sorgulama linki olarak çalışır. Kullanıcının girdiği gerçek KEP adresi, Vergi No ve kurumsal bilgileri koru.



## 6. Güvenlik Standartları (Security Audit)

-  Her `/api/admin/*` ucunda `verifyAdminSession` kontrolü zorunludur.

- Sipariş, dekont ve yorum görseli erişiminde sahiplik (IDOR) ve misafir 24 saat kuralları korunmalıdır.

- E-posta gönderimlerinde ve admin görünümünde `cleanGuestEmail` kullanılmalıdır.

- Dosya yükleme uçlarında Magic Bytes / MIME ve boyut kontrolü; kimlik doğrulama, sipariş ve iletişim uçlarında IP bazlı `rateLimit` zorunludur.

## 7. Bağımlılık Kuralları
- Prisma 7'de kal (^7.10.1); `npx prisma@latest` veya sürümsüz `npm install prisma` KULLANMA.
- `lib/db.ts` sorgu uzantısı Prisma'nın dahili `__internalParams.transaction` alanına dayanır; Prisma güncellenirse `tests/db-retry.test.mjs` ve yeniden deneme davranışını yeniden doğrula.

## 8. e2e Testleri (Playwright)
- `e2e/` kök projeden bağımsız alt projedir (kendi `package.json`); köke bağımlılık eklenmez. Ayrıntı: `e2e/README.md`.
- Komutlar (`cd e2e`): `npm test` (hepsi), `npm run test:desktop`, `npm run test:mobile`, `npm run test:admin`, `npm run report`.
- `E2E_DATABASE_URL` yalnızca `e2e/.env.e2e` içindedir (git'te yok; okunmaz, yazdırılmaz). Neon dalı `e2e-test`'tir.
- `public.e2e_marker` güvenlik kilidi (`e2e/safety.cjs`) hiçbir koşulda zayıflatılmaz veya atlanmaz.
- Neon dalı 5 dk boşta uykuya geçer; koşudan önce Neon SQL Editor'de `e2e-test` dalında `select 1` çalıştır.
- Testler dış servis çağırmaz: Resend/PayTR/Kargonomi anahtarları boştur, GTM isteği engellidir.
- Admin testleri yalnızca masaüstünde, `workers: 1` ile, herkese açık testlerden sonra çalışır; `E2E ` önekli veri üretir, temizler ve kalıntı denetimi (`audit.ts`) vardır.
- Tek sunucu süreci çalışır (`next start -p 3100`); bitince kapat (bellek). Kök `.next` paylaşılır.
- Sipariş testleri (`npm run test:orders`): kartlı ödeme test edilmez; Kargonomi yalnızca testte `page.route` ile taklit edilir. `/api/order` hız sınırı (10 dk'da 5) nedeniyle bir koşuda en çok 4 sipariş isteği sunucuya gider; sahte müşteri e-postası `e2e-*@example.invalid`, temizlik yalnızca bu e-postalara ve `E2E` önekli ürün/kuponlara dokunur.
- Testlerin bulduğu site hataları düzeltilmez, ayrı iş olarak raporlanır. `a-smoke` anonim 401 testi bilerek `test.fail` işaretlidir.

