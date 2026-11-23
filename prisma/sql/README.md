# prisma/sql — şema geçmişinin kaynağı

Bu klasör, veritabanı şemasının **gerçek geçmişidir**. Şema değişiklikleri buradaki elle yazılmış, **idempotent** (tekrar çalıştırması güvenli: `IF NOT EXISTS`) SQL dosyalarıyla yapılır.

## Kurallar
- `prisma/migrations/` yalnızca **ilk göçü** (`20261006011627_init_yildirim_avize`) içerir ve **KULLANILMAZ**. Oraya dokunmayın, yeni göç eklemeyin.
- `prisma migrate dev`, `prisma migrate reset` ve `prisma db push` **yasaktır** (canlı veriyi sıfırlayabilir/şemayı Prisma'nın bilmediği kurallarla ezebilir).
- Her şema değişikliği: önce bu klasöre yeni `*-ekle.sql` yazılır, **sonra** `prisma/schema.prisma` güncellenir ve kod yayınlanır (SQL önce, kod sonra).
- SQL'i **sahibi** çalıştırır (Neon SQL Editor): e2e-test dalı silindi; sıra: sahibin açacağı geçici/test dalı varsa önce orada, sonra canlıda. Yapay zekâ/CI canlı veritabanına bağlanmaz.

## Dosyalar
| Dosya | Ne yapar |
|---|---|
| `00-tam-sema.sql` | **Boş** bir veritabanında tüm şemayı sıfırdan kurar (22 tablo + Prisma'da görünmeyen CHECK ve kısmi benzersiz indeks). Dolu veritabanında çalıştırmayın. Şema değiştikçe yeniden üretilir (komut dosyanın başında). |
| `adres-defteri-ekle.sql` | `Address` tablosu |
| `alici-adi-ekle.sql` | `Order.recipientName` |
| `siparis-kalemi-ad-ekle.sql` | `OrderItem.productTitle` ve `variationLabel` (sipariş anındaki ad/renk), ikinci bölümde geriye dönük doldurma |
| `sozlesme-onayi-ekle.sql` | `Order.legalConsentAt` ve `legalConsentVersion` (sözleşme onay kaydı; eski siparişler NULL) |
| `teslim-tarihi-ekle.sql` | `Order.deliveredAt` (teslim anı), ikinci bölümde geriye dönük doldurma (yaklaşık) |
| `ebat-ekle.sql` | `Product.ebat` |
| `video-url-ekle.sql` | `Product.videoUrl` (ürün başına tek video adresi: YouTube/Vimeo/.mp4; nullable TEXT) |
| `variation-index-ekle.sql` | `ProductVariation.productId` indeksi |
| `account-deletion.sql` | `AccountDeletionRequest` tablosu, `User.lastLoginAt`, durum CHECK kuralı ve kullanıcı başına tek bekleyen talep kısmi benzersiz indeksi |
| `tamamlayici-tablo-ekle.sql` | `ProductComplement` tablosu (ana ürün ↔ tamamlayıcı ürün bağı; FK CASCADE, UNIQUE, CHECK, indeks) |
| `tamamlayici-siparis-kalemi-ve-ayar-ekle.sql` | `OrderItem.bundleMainProductId` ve `bundleDiscount`, kısmi indeks; `SiteConfig.complementSuggestCount` (+ CHECK 0-12) |

`00-tam-sema.sql` içindeki son bölüm, `account-deletion.sql` ve tamamlayıcı ürün SQL'lerindeki Prisma şemasında görünmeyen kuralları (CHECK ve kısmi benzersiz indeks) içerir.

## 00-tam-sema.sql'i yeniden üretmek
Gerçek bağlantı gerekmez; geçici bir yapılandırma dosyasına **sahte** adres verilir (`.env` okunmaz):

```bash
npx prisma migrate diff --config <sahte-adresli-config.ts> --from-empty --to-schema prisma/schema.prisma --script
```

Çıktının sonuna, Prisma şemasında gösterilemeyen kuralları (CHECK ve kısmi benzersiz indeks) ekleyin.
