// Kargonomi gönderi yanıtındaki `creation_fail_reason` alanı: yöneticiye yalnız o isteğin yanıtında kısa uyarı olarak gösterilir (kalıcı saklanmaz).
const MAX_LEN = 200;

/** Yanıttaki sebep metni; boş / metin değilse undefined. */
export function creationFailReasonOf(shipment: unknown): string | undefined {
  const v = (shipment as { creation_fail_reason?: unknown } | null | undefined)?.creation_fail_reason;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Yönetici uyarısı (düz metin, ≤200 karakter sebep); sebep yoksa null. */
export function creationFailWarning(reason: unknown): string | null {
  if (typeof reason !== "string" || !reason.trim()) return null;
  const r = reason.trim();
  return `Kargonomi gönderiyi oluşturamadı: ${r.length > MAX_LEN ? `${r.slice(0, MAX_LEN)}…` : r}`;
}
