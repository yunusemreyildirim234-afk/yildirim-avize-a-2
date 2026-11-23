-- Hesap silme talebi: YENI "AccountDeletionRequest" tablosu + User.lastLoginAt (NULL'lu) kolonu (idempotent); mevcut veriye dokunmaz.
-- Canli veritabanina ELLE uygulanir: SQL ONCE calistirilir, SONRA schema.prisma guncellenir ve kod push edilir. e2e-test dali silindi; sira: sahibin acacagi gecici/test dali varsa once orada, sonra canlida.
-- Geri alma: kodu geri almak yeterli. Istege bagli temizlik: DROP TABLE "AccountDeletionRequest"; ALTER TABLE "User" DROP COLUMN "lastLoginAt";

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | CANCELLED
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountDeletionRequest_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_createdAt_idx" ON "AccountDeletionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- Kullanici basina en fazla BIR bekleyen talep (cift tikla / yaris durumunda ikinci kayit reddedilir).
-- Kismi (partial) indeks Prisma semasinda gosterilmez; yalnizca veritabaninda vardir.
CREATE UNIQUE INDEX IF NOT EXISTS "AccountDeletionRequest_one_pending_per_user" ON "AccountDeletionRequest"("userId") WHERE "status" = 'PENDING';
