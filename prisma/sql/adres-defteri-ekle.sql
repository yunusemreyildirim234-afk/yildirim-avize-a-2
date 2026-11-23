-- Adres defteri: yalnizca YENI "Address" tablosu ve indeksi (idempotent); mevcut tablolara dokunmaz.
-- Canli veritabanina ELLE uygulanir: SQL ONCE calistirilir, kod SONRA push edilir. e2e-test dali silindi; sira: sahibin acacagi gecici/test dali varsa once orada, sonra canlida.
-- Geri alma: kodu geri almak yeterli (tablo bos kalir). Istege bagli temizlik (kayitli adresler silinir): DROP TABLE "Address";
CREATE TABLE IF NOT EXISTS "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stateId" INTEGER NOT NULL,
    "stateName" TEXT NOT NULL,
    "cityId" INTEGER NOT NULL,
    "cityName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "Address"("userId");
