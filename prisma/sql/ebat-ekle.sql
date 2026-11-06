-- Product.ebat: yalnizca ekleme, nullable (idempotent). Canli veritabanina ELLE uygulanir; kodu yayinlamadan ONCE.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ebat" TEXT;
