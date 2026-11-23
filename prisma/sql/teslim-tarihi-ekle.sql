-- Order.deliveredAt (YSL-15): sipariste DELIVERED'a gecilen an. Yalnizca ekleme, nullable, varsayilansiz (idempotent).
-- Canli veritabanina ELLE uygulanir: SQL ONCE, kod SONRA. e2e-test dali silindi; sira: sahibin acacagi gecici/test dali varsa once orada, sonra canlida.
-- Geri alma: kodu geri almak yeterli; istege bagli temizlik: ALTER TABLE "Order" DROP COLUMN "deliveredAt";
-- Indeks GEREKMEZ: yalnizca siparis sayfasinda tek satir icin okunur.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- 2. bolum: geriye dogru doldurma (idempotent, yalniz "deliveredAt IS NULL" ve status = 'DELIVERED').
-- Gercek teslim ani eski siparislerde yok. Tahmin = LEAST(Order.updatedAt, fatura yukleme zamani): ikisi de teslimden SONRADIR,
-- yani cayma suresi musteri lehine uzun gorunur. RETURNED satirlari NULL kalir. Sonuc "yaklasik"tir; ayri isaret sutunu yok.
UPDATE "Order" o
SET "deliveredAt" = LEAST(o."updatedAt", COALESCE(inv."uploadedAt", o."updatedAt"))
FROM (SELECT o2."id", i."uploadedAt" FROM "Order" o2 LEFT JOIN "OrderInvoice" i ON i."orderId" = o2."id") inv
WHERE inv."id" = o."id"
  AND o."status" = 'DELIVERED'
  AND o."deliveredAt" IS NULL;
-- Dogrulama (0 donmeli): SELECT count(*) FROM "Order" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;
