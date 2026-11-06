import type { Prisma } from "@/generated/prisma/client";

/** Arama sorgusu en çok bu kadar karakter (API ve /arama sayfası aynı sınırı kullanır). */
export const MAX_SEARCH_LEN = 80;
/** /arama sayfasında listelenebilecek en çok ürün (sayfalama bu tavana kadar). */
export const MAX_SEARCH_RESULTS = 500;

/** Ham sorguyu sınırlar (boşluklar kırpılmadan döner; boşluk kontrolü çağıranda). */
export const clipQuery = (raw: string | null | undefined) => (raw || "").slice(0, MAX_SEARCH_LEN);

/**
 * Arama koşulunun TEK tanımı (/api/search ve /arama): aktif ürün; başlık, açıklama, kategori (büyük/küçük harf duyarsız),
 * varyasyon barkodu / stok kodu veya tam model kodu eşleşmesi. `q` boş olmamalıdır.
 */
export function searchWhere(q: string): Prisma.ProductWhereInput {
  const code = q.trim();
  return {
    active: true,
    OR: [
      { modelCode: code },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { variations: { some: { barcode: { contains: code } } } },
      { variations: { some: { stockCode: { contains: code, mode: "insensitive" } } } },
    ],
  };
}
