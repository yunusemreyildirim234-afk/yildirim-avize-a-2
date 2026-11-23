-- ProductVariation.productId indeksi (schema.prisma @@index([productId]) ile aynı ad).
-- ELLE çalıştırılır: Neon SQL Editor. Kod bu indeks olmadan da çalışır; ek ve zararsızdır, veri değiştirmez.
-- e2e-test dalı silindi; sıra: sahibin açacağı geçici/test dalı varsa önce orada, sonra canlıda (her birinde bir kez). Tekrar çalıştırmak güvenlidir.
CREATE INDEX IF NOT EXISTS "ProductVariation_productId_idx" ON "ProductVariation" ("productId");
