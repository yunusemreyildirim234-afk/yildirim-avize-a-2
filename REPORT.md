# Rapor — 5 Aşamalı İyileştirme

Dokunulmayanlar: `/api/paytr/*`, `lib/kargonomi.ts`, WhatsApp butonları, Kuveyt Türk alıcı adı, `.env*`.

## 1. ETBİS ve Kurumsal Bilgiler
- Karekod görseli zorunluluğu kaldırıldı (`etbisQrImage`: tip, API, admin formu, footer). DB kolonu şemada duruyor (migration gerekmedi, eski veri zararsız).
- `etbisUrl` artık footer ve iletişim sayfasında "ETBİS Kayıt Doğrulama" rozet/bağlantısı olarak gösteriliyor.
- `CompanyInfo`: `/örnek|ornek/` regex filtresi kaldırıldı. Yalnızca boş değer veya birebir fabrika yer tutucusu gizlenir; girilen gerçek KEP/MERSİS/Vergi bilgisi her zaman görünür.
- Mesafeli Satış Sözleşmesi sayfasındaki SATICI satırı artık admin'deki unvan, vergi dairesi/no, MERSİS, KEP ve adresi dinamik basıyor.
- Not: sepetteki `ContractModal` (client) şirket bilgisi almıyor; tam metin sayfasına bağlantı veriyor.

## 2. Güvenlik
- `proxy.ts` matcher'ı `/admin`, `/api/admin/*`, `/api/seed` için yönetici oturumu zorunlu kılıyor (doğrulandı).
- Dekont (`/api/receipts/[orderId]`), yorum görseli, dekont yükleme: sahip veya admin dışına 403 (IDOR korumalı, doğrulandı).
- Yeni rate-limit: `/api/auth/verify-code`, `/api/reviews` (POST), `/api/orders/request` (POST).
- Başlıklar: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (kamera/mikrofon/konum kapalı, `payment=(self)`). CSP eklenmedi (PayTR iframe/Google OAuth riski).
- Bilinen sınır: rate-limit bellek içi; sunucusuz ortamda tam koruma için Redis/Upstash gerekir.

## 3. SEO / Performans
- Product JSON-LD zaten tam (ad, görseller, açıklama, SKU=modelCode, marka, TRY fiyat, InStock/OutOfStock, aggregateRating). Eklenen: göreli görsel URL'leri mutlak yapılıyor, `offers.seller`.
- `ProductCard` `priority` prop'u; kategori sayfasında ilk 4, ana sayfada ilk 2 kart öncelikli. `sizes` zaten tanımlıydı.
- Galeri küçük resimlerine `width/height` + `decoding="async"` (CLS azaltma).

## 4. UX / Mobil
- Global `:focus-visible` halkası (base layer; mevcut utility'ler ezmez) ve `overflow-x: clip` güvenlik ağı.
- Ürün detay: mobil padding, min-h, rozet taşması, varyasyon seçenekleri `radiogroup` + 1 sütun (<420px), adet/sepet butonları ≥44px.
- Arama sonucu boş durumları "Tüm koleksiyona göz atın" bağlantısı; boş sepet lucide ikonlu.

## 5. Tasarım Cilası
- ProductCard: serif başlık, büyük harf kategori etiketi, tabular rakamlar, yumuşak gölge.
- Detay: başlık/açıklama satır yüksekliği ve kontrast, pulse animasyonu ve blur kaldırıldı.
- Footer: saf siyah yerine `zinc-950`, kontrast ve tıklama alanları.

## Doğrulama
`npx tsc --noEmit` ve `npm run build`: hatasız.
