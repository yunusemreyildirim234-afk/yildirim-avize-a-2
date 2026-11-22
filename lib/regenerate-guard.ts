// "Barkodu Yeniden Üret" koruması (saf; yenileme enjekte edilir): aktif/onaylı gönderi varken ikinci gönderi açılmaz.
// Kargonomi durum değerleri lib/kargonomi.ts KARGONOMI_STATUS_LABELS'tan: "draft" (Taslak) ve "cancelled" (İptal Edildi).
// Bunların dışındaki her değer (ready, webservice_shipment_started, webservice_shipment_delivered ve BİLİNMEYENLER) "aktif" sayılır (güvenli taraf).

export const REGENERATE_ALLOWED_STATUSES = ["draft", "cancelled"] as const;

export const REGENERATE_BLOCKED_MESSAGE =
  "Mevcut gönderi aktif. Önce Kargonomi panelinden gönderiyi iptal et, sonra 'Durumu Yenile'ye bas, ardından yeniden üret.";

export type RegenerateDecision = { action: "proceed" } | { action: "blocked"; message: string };

export async function decideRegenerate(
  order: { kargonomiShipmentId: number | null },
  regenerate: boolean,
  refresh: () => Promise<{ kargonomiStatus: string | null }>,
): Promise<RegenerateDecision> {
  if (!regenerate || !order.kargonomiShipmentId) return { action: "proceed" };
  const fresh = await refresh(); // hata fırlatırsa yeni gönderi AÇILMAZ (çağıran hatayı iletir)
  const status = (fresh.kargonomiStatus ?? "").trim().toLowerCase();
  return (REGENERATE_ALLOWED_STATUSES as readonly string[]).includes(status) ? { action: "proceed" } : { action: "blocked", message: REGENERATE_BLOCKED_MESSAGE };
}
