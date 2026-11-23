-- Order.legalConsentAt / legalConsentVersion: yalnizca ekleme, nullable, varsayilansiz (idempotent).
-- Kisisel veri EKLENMEZ: IP / tarayici bilgisi tutulmaz (siparis zaten userId'ye bagli). IP istenirse KVKK danismani karari (rapor 13, soru 8).
-- Mevcut satirlar GERIYE DOLDURULMAZ: gecmise donuk onay "uydurulmaz"; NULL = "kayit oncesi siparis".
-- Canli veritabanina ELLE uygulanir: SQL ONCE, kod SONRA. e2e-test dali silindi; sira: sahibin acacagi gecici/test dali varsa once orada, sonra canlida.
-- Geri alma: kodu geri almak yeterli; istege bagli temizlik:
--   ALTER TABLE "Order" DROP COLUMN "legalConsentAt", DROP COLUMN "legalConsentVersion";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legalConsentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legalConsentVersion" TEXT;
