// Vitrin veri önbelleği için saf anahtar/etiket yardımcıları (kişiye özel girdi kabul etmez; test edilebilir).

/** Menü, kategori ayarları, görünürlük ve liste girdilerinin ORTAK sürümü: satır şekli değişince artırılır, hepsi birlikte yeni anahtara geçer (biri bayat, biri taze kalmaz). */
export const STOREFRONT_CACHE_VERSION = "v9"; // v5: satıra title; v6: inStock; v7: search ve mc; v8: menü/ayar/görünürlük de bu sürüme bağlandı; v9: satıra rc/active/disc, açıklama 300 karakter

/** Paylaşılan katalog satırları (lib/listing.ts) için süre: stok/fiyat/ürün değişiklikleri "storefront" etiketiyle zaten anında geçersiz kılar; süre yalnızca yedektir. */
export const LISTING_ROWS_CACHE_SECONDS = 300;

type Where = Record<string, unknown> | undefined;

/** Parametreler (where/take/skip) farklıysa anahtar farklıdır; yalnızca JSON'a çevrilebilir sorgu parametrelerinden üretilir. */
export const productsCacheKey = (where: Where, take?: number, skip?: number) => JSON.stringify([where ?? {}, take ?? null, skip ?? null]);

/** where içinde düz bir kategori eşitliği varsa kategoriye özel etiket ("category:<ad>"). */
export function categoryTagOf(where: Where): string | null {
  const c = where?.category;
  return typeof c === "string" && c ? `category:${c}` : null;
}

/** Her önbellek girdisinin etiketleri: genel "storefront" (revalidateStorefront bunu geçersiz kılar) + varsa kategoriye özel. */
export const storefrontTags = (where: Where): string[] => ["storefront", ...(categoryTagOf(where) ? [categoryTagOf(where)!] : [])];
