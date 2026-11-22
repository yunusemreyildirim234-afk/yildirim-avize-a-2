// "Barkodu Yeniden Üret" koruması (saf; yenileme enjekte edilir): aktif/onaylı gönderi varken ikinci gönderi açılmaz.
// Kargonomi durum değerleri lib/kargonomi.ts KARGONOMI_STATUS_LABELS'tan: "draft" (Taslak) ve "cancelled" (İptal Edildi).
// "İptal Talebi Alındı" için tabloda anahtar YOK (tahmin edilmez); bilinmeyen değer engellenir, ham değer mesajda görünür.
// Bunların dışındaki her değer (ready, webservice_shipment_started, webservice_shipment_delivered ve BİLİNMEYENLER) "aktif" sayılır (güvenli taraf).

export const REGENERATE_ALLOWED_STATUSES = ["draft", "cancelled"] as const;

/** Engelleme mesajı; Kargonomi'nin döndürdüğü HAM durum değeri görünür (bilinmeyen bir iptal kelimesi ilk denemede anlaşılsın). */
export const regenerateBlockedMessage = (rawStatus: string | null | undefined) =>
  `Mevcut gönderi aktif görünüyor (Kargonomi durumu: ${(rawStatus ?? "").trim() || "boş"}). Önce Kargonomi panelinden iptal et, sonra 'Durumu Yenile'ye bas, ardından yeniden üret.`;

export type RegenerateDecision = { action: "proceed" } | { action: "blocked"; message: string };

export async function decideRegenerate(
  order: { kargonomiShipmentId: number | null },
  regenerate: boolean,
  refresh: () => Promise<{ kargonomiStatus: string | null }>,
): Promise<RegenerateDecision> {
  if (!regenerate || !order.kargonomiShipmentId) return { action: "proceed" };
  const fresh = await refresh(); // hata fırlatırsa yeni gönderi AÇILMAZ (çağıran hatayı iletir)
  const status = (fresh.kargonomiStatus ?? "").trim().toLowerCase();
  return (REGENERATE_ALLOWED_STATUSES as readonly string[]).includes(status) ? { action: "proceed" } : { action: "blocked", message: regenerateBlockedMessage(fresh.kargonomiStatus) };
}
