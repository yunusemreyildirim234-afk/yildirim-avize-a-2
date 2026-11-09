-- ProductVariation.productId indeksi (schema.prisma @@index([productId]) ile aynı ad).
-- ELLE çalıştırılır: Neon SQL Editor. Kod bu indeks olmadan da çalışır; ek ve zararsızdır, veri değiştirmez.
-- Dallar ve sıra: önce e2e-test, sonra production (ikisinde de bir kez). Tekrar çalıştırmak güvenlidir.
CREATE INDEX IF NOT EXISTS "ProductVariation_productId_idx" ON "ProductVariation" ("productId");
