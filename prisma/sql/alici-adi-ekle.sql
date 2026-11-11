-- Order.recipientName: yalnizca ekleme, nullable (idempotent). Canli veritabanina ELLE uygulanir: SQL ONCE calistirilir, kod SONRA push edilir.
-- Once Neon "e2e-test" dalinda, sonra canlida. Geri alma: kodu geri almak yeterli (sutun bos kalir); istege bagli temizlik: ALTER TABLE "Order" DROP COLUMN "recipientName";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
