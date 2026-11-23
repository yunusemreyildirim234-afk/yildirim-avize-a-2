-- Order.recipientName: yalnizca ekleme, nullable (idempotent). Canli veritabanina ELLE uygulanir: SQL ONCE calistirilir, kod SONRA push edilir.
-- e2e-test dali silindi; sira: sahibin acacagi gecici/test dali varsa once orada, sonra canlida. Geri alma: kodu geri almak yeterli (sutun bos kalir); istege bagli temizlik: ALTER TABLE "Order" DROP COLUMN "recipientName";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
