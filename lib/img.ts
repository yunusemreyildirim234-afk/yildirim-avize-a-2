// Vercel Blob'a kopyalanmış ürün görselleri için SAF yardımcılar (içe aktarma yok; istemci ve sunucuda kullanılır).
// Her görselin iki sürümü vardır (tools/gorsel/kopyala.mjs üretir): "...-b.webp" (büyük, en çok 1600 px; veritabanında bu durur)
// ve "...-k.webp" (küçük, en çok 800 px). Blob dışındaki adresler (Trendyol, /api/product-images/...) her zaman AYNEN döner.
const BLOB_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const BIG_RE = /-b\.webp$/;
const TRENDYOL_RE = /^https:\/\/([a-z0-9-]+\.)*dsmcdn\.com\//i;

export const isBlobImage = (url: string | null | undefined): url is string => typeof url === "string" && BLOB_RE.test(url);

/** İki sürümü olan kopyalanmış görsel mi ("-b.webp" ile biten Blob adresi)? */
const hasSmall = (url: string | null | undefined): url is string => isBlobImage(url) && BIG_RE.test(url);

/** Kart / küçük resim adresi: kopyalanmış görselde "-k" sürümü, diğerlerinde adresin kendisi. */
export function smallImage<T extends string | null | undefined>(url: T): T {
  return (hasSmall(url) ? url.replace(BIG_RE, "-k.webp") : url) as T;
}

/** Ürün sayfası ana görseli için srcset (800w / 1600w); kopyalanmamış görselde undefined. */
export function imageSrcSet(url: string | null | undefined): string | undefined {
  return hasSmall(url) ? `${smallImage(url)} 800w, ${url} 1600w` : undefined;
}

/** Henüz Blob'a kopyalanmamış (Trendyol'dan doğrudan gösterilen) tekil görsel sayısı. */
export function countUncopiedImages(lists: readonly (readonly (string | null | undefined)[])[]): number {
  const seen = new Set<string>();
  for (const l of lists) for (const u of l) if (typeof u === "string" && TRENDYOL_RE.test(u)) seen.add(u);
  return seen.size;
}
