// Kargo barkodu oluşturmanın saf çekirdeği: önce koşullu sahiplenme, sonra gönderi, sonra koşullu barkod yazımı (sipariş durumu değişmez).
// Veritabanı ve Kargonomi çağrıları parametredir (test edilebilir).

/** Barkod yalnızca ödemesi onaylanmış (hazırlanıyor) veya zaten kargodaki siparişte oluşturulur. */
export const SHIPPABLE_STATUSES = ["PENDING", "SHIPPED"];

export const KARGONOMI_TIMEOUT_MESSAGE = "Kargonomi yanıt vermedi. Gönderi açılmış olabilir, yeniden denemeden önce Kargonomi panelini kontrol edin.";

/** İstek zaman aşımına uğradı / kesildi mi? (AbortSignal.timeout → "TimeoutError", elle kesme → "AbortError"; fetch bunu `cause` içinde de taşıyabilir) */
export function isTimeoutError(e: unknown): boolean {
  const name = (x: unknown) => (x && typeof x === "object" ? String((x as { name?: unknown }).name ?? "") : "");
  return ["TimeoutError", "AbortError"].includes(name(e)) || ["TimeoutError", "AbortError"].includes(name((e as { cause?: unknown } | null)?.cause));
}

export type ShippingResult<T> = { outcome: "CLAIM_LOST" } | { outcome: "STATUS_CHANGED"; shipped: T } | { outcome: "OK"; shipped: T };

export interface ShippingDeps<T> {
  /** Koşullu sahiplenme (updateMany: durum uygun + labelCreated okunan değerde); yalnızca bir istek kazanır. */
  claim: () => Promise<boolean>;
  /** Kargonomi gönderisini açar / yeniler. */
  open: () => Promise<T>;
  /** Koşullu barkod/firma yazımı (yalnızca sipariş hâlâ PENDING/SHIPPED ise; durum alanına dokunulmaz); yazıldıysa true. */
  finish: (shipped: T) => Promise<boolean>;
  /** Gönderi açılamadıysa sahiplenmeyi geri bırakır (yeniden denenebilsin). */
  release: () => Promise<unknown>;
}

/**
 * - Çift tıklama / iki sekme: ikinci istek sahiplenmeyi kaybeder (CLAIM_LOST), ikinci gönderi açılmaz, ikinci e-posta gitmez.
 * - Gönderi açılırken sipariş iptal/iade edildiyse barkod yazılmaz (STATUS_CHANGED).
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
