import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Vitrin (ana sayfa, ürün, kategori, Çok Satanlar önbelleği) tek merkezî yenileme noktası.
 * Yönetici işlemleri (ürün, toplu işlem, Geri Al, ana sayfa/avantaj kartları, indirim ayarı, kupon, stok) başarıyla bitince çağrılır.
 */
export function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/urun/[id]", "page");
  revalidatePath("/kategori/[slug]", "page");
  revalidateTag("storefront", "max");
}

/** Route handler sarmalayıcı: yanıt başarılıysa (2xx) vitrin yenilenir. Hata yanıtlarında yenileme yapılmaz. */
export function withStorefrontRevalidate<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const res = await handler(...args);
    if (res.ok) revalidateStorefront();
    return res;
  };
}
