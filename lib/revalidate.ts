import { revalidatePath, revalidateTag } from "next/cache";
import { runQuietly } from "@/lib/stock-freshness";

/**
 * Vitrin (ana sayfa, ürün, kategori, Çok Satanlar önbelleği) tek merkezî yenileme noktası.
 * Yönetici işlemleri (ürün, toplu işlem, Geri Al, ana sayfa/avantaj kartları, indirim ayarı, kupon, stok) başarıyla bitince çağrılır.
 */
export function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/urun/[id]", "page");
  revalidatePath("/kategori/[slug]", "page");
  // expire: 0 → menü, liste, kartlar ve kategori ayarları (hepsi "storefront" etiketli) birlikte hemen sona erer; sonraki istek taze okur, bayat veri sunulmaz
  revalidateTag("storefront", { expire: 0 });
}

/**
 * Stok değiştiren müşteri/sistem yolları (sipariş oluşturma, stok iadesi, cron) için en iyi çaba sürümü: veritabanı işlemi BİTTİKTEN sonra çağrılır,
 * hata verirse yalnızca kaydedilir; siparişi/iadeyi asla bozmaz. Yönetici uçları withStorefrontRevalidate kullanmaya devam eder.
 */
export function revalidateStorefrontSafe(): boolean {
  return runQuietly(revalidateStorefront, (err) => console.error("[vitrin] önbellek yenilenemedi:", (err as Error)?.message));
}

/** Route handler sarmalayıcı: yanıt başarılıysa (2xx) vitrin yenilenir. Hata yanıtlarında yenileme yapılmaz. */
export function withStorefrontRevalidate<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const res = await handler(...args);
    if (res.ok) revalidateStorefront();
    return res;
  };
}
