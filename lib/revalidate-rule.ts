// Vitrin yenileme kararı için SAF kurallar (Next bağımlılığı yok; test edilebilir).
// revalidateStorefront() tüm vitrin önbelleğini boşaltır ve sonraki ziyaretçide kataloğun veritabanından yeniden okunmasına yol açar;
// vitrinde görünen hiçbir şeyi (stok, fiyat, ürün, görünürlük, kupon, yorum) değiştirmeyen işlemlerde çağrılmaz.

/** Yanıt bu başlığı taşıyorsa withStorefrontRevalidate vitrini yenilemez. */
export const STOREFRONT_UNCHANGED_HEADER = "x-vitrin-degismedi";
export const STOREFRONT_UNCHANGED = { headers: { [STOREFRONT_UNCHANGED_HEADER]: "1" } } as const;

/** Başarılı (2xx) ve "değişmedi" işareti taşımayan yanıt vitrini yeniler. */
export const shouldRevalidate = (res: { ok: boolean; headers: { get(name: string): string | null } }): boolean => res.ok && res.headers.get(STOREFRONT_UNCHANGED_HEADER) !== "1";

/**
 * Sipariş durumu değişikliği vitrini yalnızca stok oynadıysa etkiler (iptal/iade/başarısız: iade; yeniden açma: düşüm).
 * Hazırlanıyor → kargoda → teslim gibi geçişlerde stok ve fiyat aynı kalır. (Çok Satanlar sırası kendi 5 dk'lık süresiyle yenilenir.)
 */
export const statusChangeTouchesStorefront = (plan: { restoreStock: boolean; ensureStock: boolean }): boolean => plan.restoreStock || plan.ensureStock;
