-- UYGULANDI (sahip beyanı): canlı veritabanında, yaklaşık 15 Kasım 2026; 23 Kasım 2026'da K-1…K-3 salt okuma sorgularıyla canlıda doğrulandı. e2e-test dalı sonradan silindi (gerekirse yeniden açılır). (plan-23, sürüm 2: içerik değişmedi; ürün düzeyi bağ ve "ürün ya ana ya tamamlayıcı" kuralı kararlarla teyit edildi,
-- kural uygulamada denetlenir, SQL'de ifade edilemez). (Çalıştırma sırası: e2e-test dalı silindi; sıra: sahibin açacağı geçici/test dalı varsa önce orada, sonra canlıda; test dalında önce `select 1`.)
-- Geri alma (yorum): DROP TABLE IF EXISTS "ProductComplement";
-- Idempotent: tekrar çalıştırması güvenlidir.

CREATE TABLE IF NOT EXISTS "ProductComplement" (
  "id"                  TEXT             NOT NULL,
  "mainProductId"       TEXT             NOT NULL,
  "complementProductId" TEXT             NOT NULL,
  "discountType"        TEXT             NOT NULL,
  "discountValue"       DOUBLE PRECISION NOT NULL,
  "position"            INTEGER          NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "ProductComplement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductComplement_type_check" CHECK ("discountType" IN ('PERCENT', 'FIXED')),
  CONSTRAINT "ProductComplement_value_check" CHECK ("discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" < 100)),
  CONSTRAINT "ProductComplement_distinct_check" CHECK ("mainProductId" <> "complementProductId")
);

-- Yabancı anahtarlar (ürün silinince bağ da silinir). IF NOT EXISTS yok: kısıt adı kontrolüyle idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductComplement_mainProductId_fkey') THEN
    ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_mainProductId_fkey"
      FOREIGN KEY ("mainProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductComplement_complementProductId_fkey') THEN
    ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_complementProductId_fkey"
      FOREIGN KEY ("complementProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductComplement_mainProductId_complementProductId_key"
  ON "ProductComplement" ("mainProductId", "complementProductId");
CREATE INDEX IF NOT EXISTS "ProductComplement_complementProductId_idx"
  ON "ProductComplement" ("complementProductId");

-- Doğrulama: 0 satır dönmeli
-- SELECT * FROM "ProductComplement" LIMIT 1;
