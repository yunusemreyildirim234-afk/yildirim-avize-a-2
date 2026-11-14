// Yönetim paneli ürün listesi için DAR veri: liste yalnız bu alanları kullanır (görsel dizileri düzenleyici açılınca ayrı çekilir).
// Saf, bağımlılıksız (Prisma'ya yalnız `select` nesnesi olarak verilir). Kapak SQL'i: lib/admin-product-covers.ts.
import { coverImageOf } from "./variation-input.ts";

// Değişmez true türü: Prisma çıkarımı yalnız seçilen alanları döndürür; `as const` dizileri salt okunur yapıp orderBy türünü bozduğu için kullanılmaz.
const T = true as const;

export const ADMIN_LIST_VARIATION_SELECT = {
  id: T,
  variationType: T,
  variationValue: T,
  extraPrice: T,
  stock: T,
  stockCode: T,
  barcode: T,
};

export const ADMIN_LIST_PRODUCT_SELECT = {
  id: T,
  title: T,
  category: T,
  basePrice: T,
  listPrice: T,
  active: T,
  isFeatured: T,
  isBestSeller: T,
  couponAllowed: T,
  pickupDiscountPct: T,
  transferDiscountPct: T,
  bulkTiers: T,
  trendyolMainId: T,
  modelCode: T,
  ebat: T,
  variations: { select: ADMIN_LIST_VARIATION_SELECT, orderBy: [{ position: "asc" as const }, { id: "asc" as const }] },
};

/**
 * Kapak kuralının SAF aynası (SQL ile aynı sıra): images'ın ilk dolu elemanı → imageUrl → sıradaki ilk fotoğraflı rengin ilk dolu fotoğrafı.
 * `coverImageOf` (lib/variation-input.ts) ile aynı sonucu verir; test iki yolu karşılaştırır, SQL'in sırası kaynak testiyle sabitlenir.
 */
export function coverByRule(images: readonly (string | null)[], imageUrl: string | null, variationImages: readonly (readonly (string | null)[])[]): string | null {
  const first = (l: readonly (string | null)[]) => l.find((u): u is string => typeof u === "string" && u !== "") ?? null;
  return first(images) ?? (imageUrl ? imageUrl : null) ?? variationImages.map(first).find((u) => u !== null) ?? null;
}

/** Dar satıra kapağı `imageUrl` olarak bindirir: bileşendeki `coverImageOf(product)` değişmeden aynı kapağı bulur. */
export function withCover<T extends { id: string }>(rows: readonly T[], covers: ReadonlyMap<string, string>): (T & { imageUrl: string | null })[] {
  return rows.map((r) => ({ ...r, imageUrl: covers.get(r.id) ?? null }));
}

/** Düzenleyici açılınca çekilen tam görseller (GET /api/admin/product?fields=images). */
export interface ProductImagesDetail {
  imageUrl: string | null;
  images: string[];
  variations: { id: string; images: string[] }[];
}

/** Liste ürününe tam görselleri bindirir (düzenleyiciye giden ürün). Rengin kaydı yoksa fotoğrafı boş sayılır. */
export function mergeImages<P extends { variations: { id: string }[] }>(product: P, detail: ProductImagesDetail): P & { imageUrl: string | null; images: string[]; variations: (P["variations"][number] & { images: string[] })[] } {
  const byId = new Map(detail.variations.map((v) => [v.id, v.images]));
  return { ...product, imageUrl: detail.imageUrl, images: detail.images, variations: product.variations.map((v) => ({ ...v, images: byId.get(v.id) ?? [] })) };
}

/** Satırdaki kapak: tam veri geldiyse ondan (kayıttan sonra anında güncel), yoksa listeye bindirilmiş kapak. */
export function rowCover(product: { imageUrl?: string | null; variations: { id: string }[] }, detail: ProductImagesDetail | undefined): string | null {
  if (!detail) return product.imageUrl ?? null;
  return coverImageOf({ imageUrl: detail.imageUrl, images: detail.images, variations: product.variations.map((v) => ({ images: detail.variations.find((d) => d.id === v.id)?.images ?? [] })) });
}
