-- UYGULANDI (sahip beyanı): canlı veritabanında, yaklaşık 15 Kasım 2026; 23 Kasım 2026'da K-1…K-3 salt okuma sorgularıyla canlıda doğrulandı. e2e-test dalı sonradan silindi (gerekirse yeniden açılır). (plan-23, sürüm 2.) (Çalıştırma sırası: e2e-test dalı silindi; sıra: sahibin açacağı geçici/test dalı varsa önce orada, sonra canlıda; test dalında önce `select 1`.)
-- Yalnız nullable sütun ekleme (varsayılan yok); mevcut satır ve kod bozulmaz. Geriye dönük doldurma YOK.
-- Dosya adı sürüm 1'de `02-siparis-kalemi-tamamlayici-ekle.sql` idi; B bölümü (SiteConfig) sürüm 2'de eklendi.
-- Geri alma (yorum):
--   ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "bundleMainProductId", DROP COLUMN IF EXISTS "bundleDiscount";
--   ALTER TABLE "SiteConfig" DROP CONSTRAINT IF EXISTS "SiteConfig_complementSuggestCount_check", DROP COLUMN IF EXISTS "complementSuggestCount";

-- ===== A) Sipariş kalemi: hangi ana ürün nedeniyle, toplam ne kadar indirim =====
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "bundleMainProductId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "bundleDiscount" DOUBLE PRECISION;

-- İsteğe bağlı (rapor için, küçük kısmi indeks; Prisma şemasında görünmez):
CREATE INDEX IF NOT EXISTS "OrderItem_bundleMainProductId_idx"
  ON "OrderItem" ("bundleMainProductId") WHERE "bundleMainProductId" IS NOT NULL;

-- ===== B) YENİ: Öneri kartı sayısı ayarı (SiteConfig tek satırı, id = 1) =====
-- NULL = varsayılan (4, kodda), 0 = öneriler kapalı, 1-12 = kart sayısı. Varsayılan DEĞER YOK (NULL kalır).
ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "complementSuggestCount" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteConfig_complementSuggestCount_check') THEN
    ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_complementSuggestCount_check"
      CHECK ("complementSuggestCount" IS NULL OR "complementSuggestCount" BETWEEN 0 AND 12);
  END IF;
END $$;

-- Doğrulama: üç sütun görünmeli
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE (table_name = 'OrderItem' AND column_name IN ('bundleMainProductId', 'bundleDiscount'))
--     OR (table_name = 'SiteConfig' AND column_name = 'complementSuggestCount');
