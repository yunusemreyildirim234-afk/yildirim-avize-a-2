// Kargo barkodu oluşturmanın saf çekirdeği: önce koşullu sahiplenme, sonra gönderi, sonra koşullu "kargoya verildi" yazımı.
// Veritabanı ve Kargonomi çağrıları parametredir (test edilebilir).

/** Barkod yalnızca ödemesi onaylanmış (hazırlanıyor) veya zaten kargodaki siparişte oluşturulur. */
export const SHIPPABLE_STATUSES = ["PENDING", "SHIPPED"];

export type ShippingResult<T> = { outcome: "CLAIM_LOST" } | { outcome: "STATUS_CHANGED"; shipped: T } | { outcome: "OK"; shipped: T };

export interface ShippingDeps<T> {
  /** Koşullu sahiplenme (updateMany: durum uygun + labelCreated okunan değerde); yalnızca bir istek kazanır. */
  claim: () => Promise<boolean>;
  /** Kargonomi gönderisini açar / yeniler. */
  open: () => Promise<T>;
  /** Koşullu durum yazımı (yalnızca sipariş hâlâ PENDING/SHIPPED ise SHIPPED); yazıldıysa true. */
  finish: (shipped: T) => Promise<boolean>;
  /** Gönderi açılamadıysa sahiplenmeyi geri bırakır (yeniden denenebilsin). */
  release: () => Promise<unknown>;
}

/**
 * - Çift tıklama / iki sekme: ikinci istek sahiplenmeyi kaybeder (CLAIM_LOST), ikinci gönderi açılmaz, ikinci e-posta gitmez.
 * - Gönderi açılırken sipariş iptal/iade edildiyse durum SHIPPED yapılmaz (STATUS_CHANGED); müşteriye bildirim gitmez.
 * - Kargonomi hata verirse sahiplenme bırakılır ve hata çağırana iletilir.
 */
export async function createShippingOnce<T>(deps: ShippingDeps<T>): Promise<ShippingResult<T>> {
  if (!(await deps.claim())) return { outcome: "CLAIM_LOST" };
  let shipped: T;
  try {
    shipped = await deps.open();
  } catch (e) {
    await deps.release().catch(() => {});
    throw e;
  }
  return (await deps.finish(shipped)) ? { outcome: "OK", shipped } : { outcome: "STATUS_CHANGED", shipped };
}
