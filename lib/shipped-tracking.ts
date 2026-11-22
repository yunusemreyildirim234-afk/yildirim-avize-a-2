// "Kargoya Verildi" geçişinden önce gerçek takip kodunun var olduğunu güvenceye alan karar (saf; yenileme ve bekleme enjekte edilir).
// Yalnız standart kargo siparişi ve henüz kargoda olmayan sipariş etkilenir; mağazadan teslim (READY_FOR_PICKUP) akışına dokunulmaz.

export const TRACKING_REFRESH_ATTEMPTS = 2;
export const TRACKING_REFRESH_DELAY_MS = 2000;

export const TRACKING_PENDING_MESSAGE =
  "Gerçek takip kodu henüz oluşmadı. Yine de 'Kargoya Verildi' yapılsın mı? Müşteriye gönderi barkodu gidecek.";
export const BARCODE_PENDING_MESSAGE = "Barkod henüz oluşturulmadı. Yine de 'Kargoya Verildi' yapılsın mı? Müşteriye takip bilgisi gitmeyecek.";

export interface ShippedTrackingOrder {
  status: string;
  shippingType: string;
  shippingTrackingCode: string | null;
  shippingBarcode: string | null;
  kargonomiShipmentId: number | null;
}

export type TrackingDecision =
  | { action: "proceed"; forced: boolean }
  | { action: "pending"; barcodeMissing: boolean; message: string };

export interface TrackingDeps {
  /** Kargonomi'den gönderiyi yeniler (refreshOrderShipment); hata fırlatabilir. */
  refresh: (orderId: string) => Promise<{ shippingTrackingCode: string | null; shippingBarcode: string | null }>;
  sleep: (ms: number) => Promise<void>;
}

export async function decideShippedTracking(order: ShippedTrackingOrder, orderId: string, force: boolean, deps: TrackingDeps): Promise<TrackingDecision> {
  if (order.shippingType !== "STANDART_KARGO" || order.status === "SHIPPED") return { action: "proceed", forced: false };
  if (order.shippingTrackingCode) return { action: "proceed", forced: false };

  let barcode = order.shippingBarcode;
  if (order.kargonomiShipmentId) {
    for (let i = 0; i < TRACKING_REFRESH_ATTEMPTS; i++) {
      try {
        const fresh = await deps.refresh(orderId);
        barcode = fresh.shippingBarcode || barcode;
        if (fresh.shippingTrackingCode) return { action: "proceed", forced: false };
      } catch {
        // yenileme hatası durum değişimini çökertmez; sıradaki denemeye / karara geçilir
      }
      if (i < TRACKING_REFRESH_ATTEMPTS - 1) await deps.sleep(TRACKING_REFRESH_DELAY_MS);
    }
  }

  if (force) return { action: "proceed", forced: true };
  const barcodeMissing = !barcode;
  return { action: "pending", barcodeMissing, message: barcodeMissing ? BARCODE_PENDING_MESSAGE : TRACKING_PENDING_MESSAGE };
}
