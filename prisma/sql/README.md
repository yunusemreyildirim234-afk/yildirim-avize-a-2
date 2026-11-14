# prisma/sql — şema geçmişinin kaynağı

Bu klasör, veritabanı şemasının **gerçek geçmişidir**. Şema değişiklikleri buradaki elle yazılmış, **idempotent** (tekrar çalıştırması güvenli: `IF NOT EXISTS`) SQL dosyalarıyla yapılır.

## Kurallar
- `prisma/migrations/` yalnızca **ilk göçü** (`20261006011627_init_yildirim_avize`) içerir ve **KULLANILMAZ**. Oraya dokunmayın, yeni göç eklemeyin.
- `prisma migrate dev`, `prisma migrate reset` ve `prisma db push` **yasaktır** (canlı veriyi sıfırlayabilir/şemayı Prisma'nın bilmediği kurallarla ezebilir).
- Her şema değişikliği: önce bu klasöre yeni `*-ekle.sql` yazılır, **sonra** `prisma/schema.prisma` güncellenir ve kod yayınlanır (SQL önce, kod sonra).
- SQL'i **sahibi** çalıştırır (Neon SQL Editor): önce `e2e-test` dalında, sonra canlıda. Yapay zekâ/CI canlı veritabanına bağlanmaz.

## Dosyalar
| Dosya | Ne yapar |
|---|---|
| `00-tam-sema.sql` | **Boş** bir veritabanında tüm şemayı sıfırdan kurar (21 tablo + Prisma'da görünmeyen CHECK ve kısmi benzersiz indeks). Dolu veritabanında çalıştırmayın. Şema değiştikçe yeniden üretilir (komut dosyanın başında). |
| `adres-defteri-ekle.sql` | `Address` tablosu |
| `alici-adi-ekle.sql` | `Order.recipientName` |
| `ebat-ekle.sql` | `Product.ebat` |
| `variation-index-ekle.sql` | `ProductVariation.productId` indeksi |

`account-deletion.sql` (hesap silme tablosu, CHECK ve kullanıcı başına tek bekleyen talep kısmi indeksi) `denetim-duzeltme` dalındadır; `00-tam-sema.sql` içindeki son bölüm aynı kuralları içerir.

## 00-tam-sema.sql'i yeniden üretmek
Gerçek bağlantı gerekmez; geçici bir yapılandırma dosyasına **sahte** adres verilir (`.env` okunmaz):

```bash
npx prisma migrate diff --config <sahte-adresli-config.ts> --from-empty --to-schema prisma/schema.prisma --script
```

Çıktının sonuna, Prisma şemasında gösterilemeyen kuralları (CHECK ve kısmi benzersiz indeks) ekleyin.
