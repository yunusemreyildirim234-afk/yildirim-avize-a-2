-- OrderItem.productTitle / variationLabel (DB-03): yalnizca ekleme, nullable, varsayilansiz (idempotent). Canli veritabanina ELLE uygulanir:
-- SQL ONCE calistirilir, kod SONRA push edilir. Once Neon "e2e-test" dalinda, sonra canlida.
-- Geri alma: kodu geri almak yeterli (sutunlar bos kalir); istege bagli temizlik:
--   ALTER TABLE "OrderItem" DROP COLUMN "productTitle", DROP COLUMN "variationLabel";
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productTitle" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variationLabel" TEXT;

-- 2. bolum: geriye dogru doldurma (idempotent; yalnizca bos satirlari doldurur). Doldurulan deger SIPARIS ANINDAKI degil BUGUNKU ad/renktir.
UPDATE "OrderItem" oi
SET "productTitle"   = COALESCE(oi."productTitle", p."title"),
    "variationLabel" = COALESCE(oi."variationLabel", v."variationValue")
FROM "ProductVariation" v
JOIN "Product" p ON p."id" = v."productId"
WHERE oi."variationId" = v."id"
  AND (oi."productTitle" IS NULL OR oi."variationLabel" IS NULL);
-- Dogrulama (0 donmeli): SELECT count(*) FROM "OrderItem" WHERE "productTitle" IS NULL OR "variationLabel" IS NULL;
