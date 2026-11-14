import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Sipariş onay sayfası ve layout'u AYNI isteğte tek okuma paylaşır (React cache): layout yalnızca varlığı denetler, sayfa tüm veriyi kullanır.
 * Ürün için yalnızca sayfada kullanılan alanlar (kimlik, başlık, kategori, kapak görselleri) okunur; açıklama, fiyat, Trendyol alanları vb. gelmez.
 */
export const getConfirmationOrder = cache((id: string) =>
  prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, password: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          variation: {
            select: {
              variationValue: true,
              product: { select: { id: true, title: true, category: true, imageUrl: true, images: true, variations: { orderBy: { position: "asc" }, select: { images: true } } } },
            },
          },
        },
      },
    },
  })
);
