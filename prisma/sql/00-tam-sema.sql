-- 00-tam-sema.sql: BOŞ bir PostgreSQL veritabanında tüm şemayı sıfırdan kurar (prisma/schema.prisma'nın o günkü hâli).
-- Kaynak: npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script (sahte bağlantı adresiyle, veritabanına bağlanmadan) + aşağıdaki "yalnız veritabanında olan" kurallar.
-- Yalnız YENİ/BOŞ veritabanı içindir (ör. sahibin açacağı yeni bir Neon test dalını sıfırdan kurmak; "e2e-test" dalı silindi). Dolu bir veritabanında ÇALIŞTIRMAYIN: tabloları yeniden oluşturmaya çalışır ve hata verir.
-- Şema değiştikçe bu dosya yeniden üretilmeli; mevcut veritabanlarına uygulanacak değişiklikler ayrı, idempotent *-ekle.sql dosyalarıyla yapılır (README.md).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brand" TEXT,
    "listPrice" DOUBLE PRECISION,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "bulkMinQty" INTEGER,
    "bulkDiscountType" TEXT,
    "bulkDiscountValue" DOUBLE PRECISION,
    "bulkTiers" JSONB,
    "couponAllowed" BOOLEAN NOT NULL DEFAULT true,
    "pickupDiscountPct" DOUBLE PRECISION,
    "transferDiscountPct" DOUBLE PRECISION,
    "trendyolMainId" TEXT,
    "modelCode" TEXT,
    "ebat" TEXT,
    "trendyolCategory" TEXT,
    "trendyolUrl" TEXT,
    "syncSnapshot" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variationType" TEXT NOT NULL,
    "variationValue" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "stockCode" TEXT,
    "salePrice" DOUBLE PRECISION,
    "listPrice" DOUBLE PRECISION,
    "syncSnapshot" JSONB,
    "syncStock" INTEGER,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "shippingType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "phone" TEXT,
    "address" TEXT,
    "recipientName" TEXT,
    "buyerStateId" INTEGER,
    "buyerCityId" INTEGER,
    "buyerStateName" TEXT,
    "buyerCityName" TEXT,
    "packageDesi" DOUBLE PRECISION DEFAULT 3,
    "kargonomiShipmentId" INTEGER,
    "kargonomiStatus" TEXT,
    "kargonomiStatusLabel" TEXT,
    "shippingProviderId" INTEGER,
    "shippingProviderName" TEXT,
    "shippingTrackingCode" TEXT,
    "shippingBarcode" TEXT,
    "shippingPrice" TEXT,
    "barcodeUrl" TEXT,
    "labelCreated" BOOLEAN NOT NULL DEFAULT false,
    "couponCode" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "cancelReturnType" TEXT,
    "cancelReturnStatus" TEXT,
    "cancelReturnReason" TEXT,
    "cancelReturnNote" TEXT,
    "cancelReturnAt" TIMESTAMP(3),
    "orderNote" TEXT,
    "receiptUrl" TEXT,
    "receiptSenderName" TEXT,
    "invoiceType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "companyTitle" TEXT,
    "abandonedEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "receiptReminderSent" BOOLEAN NOT NULL DEFAULT false,
    "legalConsentAt" TIMESTAMP(3),
    "legalConsentVersion" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "productTitle" TEXT,
    "variationLabel" TEXT,
    "bundleMainProductId" TEXT,
    "bundleDiscount" DOUBLE PRECISION,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewImage" (
    "reviewId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("reviewId")
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyTitle" TEXT NOT NULL DEFAULT 'Ömer Yıldırım - Yıldırım Avize',
    "taxOffice" TEXT NOT NULL DEFAULT 'Beyoğlu Vergi Dairesi',
    "taxNumber" TEXT NOT NULL DEFAULT '11111111111',
    "mersisNo" TEXT NOT NULL DEFAULT '0000000000000000 (Örnek MERSİS No)',
    "kepAddress" TEXT NOT NULL DEFAULT 'ornek@hs01.kep.tr',
    "headquartersAddress" TEXT NOT NULL DEFAULT 'Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane Beyoğlu / İstanbul',
    "etbisUrl" TEXT DEFAULT 'https://www.eticaret.gov.tr',
    "etbisQrImage" TEXT,
    "maxTotalDiscountPct" DOUBLE PRECISION,
    "complementSuggestCount" INTEGER,
    "adminSessionVersion" INTEGER NOT NULL DEFAULT 0,
    "homepageConfig" JSONB,
    "showcaseCouponId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
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

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComplement" (
    "id" TEXT NOT NULL,
    "mainProductId" TEXT NOT NULL,
    "complementProductId" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CONTACT',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "discountAmount" DOUBLE PRECISION,
    "minCartTotal" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "perUserLimit" INTEGER,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "userEmail" TEXT,
    "productId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptFile" (
    "orderId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptFile_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderInvoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "OrderInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConsent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "textVersion" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sepet',
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "email" TEXT,
    "detail" TEXT,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_status_createdAt_idx" ON "AccountDeletionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_trendyolMainId_key" ON "Product"("trendyolMainId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_modelCode_key" ON "Product"("modelCode");

-- CreateIndex
CREATE INDEX "Product_active_category_idx" ON "Product"("active", "category");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_createdAt_idx" ON "ProductImage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariation_barcode_key" ON "ProductVariation"("barcode");

-- CreateIndex
CREATE INDEX "ProductVariation_productId_idx" ON "ProductVariation"("productId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_variationId_idx" ON "OrderItem"("variationId");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");

-- CreateIndex
CREATE INDEX "CartItem_userId_idx" ON "CartItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_variationId_key" ON "CartItem"("userId", "variationId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

-- CreateIndex
CREATE INDEX "ProductComplement_complementProductId_idx" ON "ProductComplement"("complementProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComplement_mainProductId_complementProductId_key" ON "ProductComplement"("mainProductId", "complementProductId");

-- CreateIndex
CREATE INDEX "ContactMessage_email_idx" ON "ContactMessage"("email");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userEmail_idx" ON "Notification"("userEmail");

-- CreateIndex
CREATE INDEX "VerificationCode_email_type_idx" ON "VerificationCode"("email", "type");

-- CreateIndex
CREATE INDEX "VerificationCode_ip_createdAt_idx" ON "VerificationCode"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInvoice_orderId_key" ON "OrderInvoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingConsent_email_key" ON "MarketingConsent"("email");

-- CreateIndex
CREATE INDEX "ClientEvent_createdAt_idx" ON "ClientEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ClientEvent_sessionId_createdAt_idx" ON "ClientEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientEvent_email_idx" ON "ClientEvent"("email");

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariation" ADD CONSTRAINT "ProductVariation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_mainProductId_fkey" FOREIGN KEY ("mainProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_complementProductId_fkey" FOREIGN KEY ("complementProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Yalnız veritabanında bulunan kurallar (Prisma şemasında gösterilmez; prisma/sql/account-deletion.sql ile aynı)
-- ---------------------------------------------------------------------------

-- Hesap silme talebi durumu yalnızca bu dört değerden biri olabilir
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));

-- Kullanıcı başına en fazla BİR bekleyen talep (çift tıklama / yarış durumunda ikinci kayıt reddedilir). Kısmi (partial) indeks.
CREATE UNIQUE INDEX IF NOT EXISTS "AccountDeletionRequest_one_pending_per_user" ON "AccountDeletionRequest"("userId") WHERE "status" = 'PENDING';

-- Tamamlayıcı ürün kuralları (prisma/sql/tamamlayici-tablo-ekle.sql ve tamamlayici-siparis-kalemi-ve-ayar-ekle.sql ile aynı)
ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_type_check" CHECK ("discountType" IN ('PERCENT', 'FIXED'));
ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_value_check" CHECK ("discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" < 100));
ALTER TABLE "ProductComplement" ADD CONSTRAINT "ProductComplement_distinct_check" CHECK ("mainProductId" <> "complementProductId");
ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_complementSuggestCount_check" CHECK ("complementSuggestCount" IS NULL OR "complementSuggestCount" BETWEEN 0 AND 12);
CREATE INDEX IF NOT EXISTS "OrderItem_bundleMainProductId_idx" ON "OrderItem" ("bundleMainProductId") WHERE "bundleMainProductId" IS NOT NULL;
