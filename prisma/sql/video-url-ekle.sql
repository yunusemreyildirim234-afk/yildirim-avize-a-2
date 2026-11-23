-- UYGULANDI (sahip beyanı): canlı veritabanında 24 Kasım 2026'da çalıştırıldı ve information_schema ile doğrulandı.
-- Product.videoUrl: ürün başına TEK video adresi (YouTube/Vimeo bağlantısı veya doğrudan .mp4 adresi). Video dosyası veritabanına konmaz; yalnız adres saklanır.
-- Yalnızca ekleme, nullable, varsayılansız, idempotent. Mevcut satırlar NULL kalır (video yok); geriye dönük doldurma yoktur.
-- Sıra: 1) bu SQL production'da (ve gerekiyorsa e2e dalında) çalıştırılır; 2) prisma/schema.prisma'ya `videoUrl String?` eklenir ve kod gelir.
-- Geri alma: kodu geri almak yeterli; isteğe bağlı temizlik: ALTER TABLE "Product" DROP COLUMN "videoUrl";
-- İndeks GEREKMEZ: yalnızca ürün sayfasında ve admin düzenleyicide tek satır için okunur.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
