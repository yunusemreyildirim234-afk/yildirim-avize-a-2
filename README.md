# Yıldırım Avize — E-Ticaret & Kargonomi API v1 Entegrasyonu

Beyoğlu Şişhane mirasını taşıyan **Yıldırım Avize** e-ticaret platformunun tam kapsamlı **Kargonomi API v1** (`https://app.kargonomi.com.tr/api/v1`) entegrasyonlu Next.js + Prisma + PostgreSQL kaynak kodu.

## 🚀 Kurulum ve Çalıştırma Adımları

1. **Ortam Değişkenlerini (`.env`) Ayarlayın:**
   Proje ana dizinindeki `.env.example` dosyasını `.env` olarak kopyalayın. Kargonomi API anahtarınız (`epiaidXMOyWe2Ky5G3qdYn6dZn5cS7VGRTXQjIVm671d3ab3`) varsayılan olarak tanımlanmıştır:
   ```env
   DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/yildirim_avize?schema=public"
   KARGONOMI_BASE_URL="https://app.kargonomi.com.tr/api/v1"
   KARGONOMI_API_TOKEN="epiaidXMOyWe2Ky5G3qdYn6dZn5cS7VGRTXQjIVm671d3ab3"
   KARGONOMI_SENDER_NAME="Yıldırım Avize Aydınlatma"
   KARGONOMI_SENDER_EMAIL="iletisim@yildirimavize.com"
   KARGONOMI_SENDER_PHONE="5372114223"
   KARGONOMI_SENDER_TAX_NUMBER="11111111111"
   KARGONOMI_SENDER_TAX_PLACE="Beyoğlu"
   KARGONOMI_SENDER_ADDRESS="Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane Beyoğlu / İstanbul"
   KARGONOMI_SENDER_STATE_ID="34"
   KARGONOMI_SENDER_CITY_ID="425"
   ```

2. **Veritabanı Şemasını Güncelleyin:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Uygulamayı Başlatın:**
   ```bash
   npm run dev
   ```

## 📦 Kargonomi API v1 Entegrasyon Modülleri

- **`lib/kargonomi.ts`**:
  - `GET /shipments`, `GET /shipments/{id}`, `POST /shipments`, `PUT /shipments/{id}`, `PATCH /shipments/{id}`, `DELETE /shipments/{id}`
  - `GET /shipment-price-comparison/{id}` (Kargo firmaları fiyat teklifi karşılaştırma)
  - `POST /confirm-shipping-price` (Seçilen kargo firması ID'si veya `-1` ile otomatik en uygun fiyatlı firmayı onaylayıp gönderiyi "İşleme Hazır" hale getirme)
  - `POST /shipments/cancel` (İşleme hazır gönderi iptal talebi)
  - `GET /shipments/{id}/barcode?format=pdf` (Base64 PDF barkod etiketi alma)
  - `POST /warehouses` (Beyoğlu Şişhane Merkez Atölye depo kaydı oluşturma)
  - `GET /user/credit` (Canlı Kargonomi bakiye/kredi sorgulama)
  - `GET /states/{countryId}` ve `GET /cities/{stateId}` (Türkiye il ve ilçe kimlikleri)
  - `GET/POST/PUT/DELETE /webhooks` ve `verifyKargonomiWebhookSignature` (`X-Webhook-Signature` HMAC-SHA256 doğrulaması)
- **`app/api/kargonomi/route.ts`**: Admin paneli ve mağaza kargo operasyonları API uç noktası.
- **`app/api/kargonomi/locations/route.ts`**: Sepet sayfasında canlı Kargonomi İl/İlçe listesi servisi (çevrimdışı yedekli).
- **`app/api/kargonomi/webhook/route.ts`**: `shipment.updated` olaylarını dinleyen ve sipariş durumunu (`PENDING` → `SHIPPED` → `DELIVERED`), kargo firmasını ve takip kodunu otomatik güncelleyen webhook alıcısı.
- **`app/admin/page.tsx` (`AdminKargonomiHeader` & `AdminKargonomiOrderActions`)**:
  - Canlı Kargonomi bakiye kartı, tek tıkla Beyoğlu Depo Kaydı ve Webhook tanımlama.
  - Her sipariş satırında Kargonomi taslak oluşturma, kargo firması fiyat teklifi seçme (Kolay Gelsin, Aras, Sürat, Hepsijet, PTT veya `-1` Otomatik), PDF Barkod indirme, canlı durum senkronizasyonu ve iptal işlemleri.
- **`app/kargo-takip/page.tsx`**: Müşterilerin sipariş kodu, takip numarası veya paket barkodu ile 4 aşamalı kargo durumunu sorgulayabildiği sayfa.
