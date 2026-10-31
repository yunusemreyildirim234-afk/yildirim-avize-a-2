/** Müşterinin talep açamayacağı sipariş durumları. */
const NO_REQUEST = ["DELIVERED", "CANCELLED", "RETURNED", "AWAITING_PAYMENT", "PAYMENT_FAILED"];

/** Teslim edilmemiş sipariş → iptal talebi; teslim edilmiş sipariş → iade talebi. */
export function requestTypeFor(status: string): "CANCEL" | "RETURN" | null {
  if (status === "DELIVERED") return "RETURN";
  return NO_REQUEST.includes(status) ? null : "CANCEL";
}

export const TRACK_STEPS = ["Sipariş Alındı", "Hazırlanıyor", "Kargoya Verildi", "Dağıtımda", "Teslim Edildi"] as const;

export type TrackState =
  | { kind: "steps"; current: number; labels: string[] }
  | { kind: "special"; tone: "red" | "orange" | "amber"; label: string; hint?: string };

interface TrackInput {
  status: string;
  shippingType?: string | null;
  kargonomiStatus?: string | null;
  kargonomiStatusLabel?: string | null;
  cancelReturnType?: string | null;
  cancelReturnStatus?: string | null;
}

/** Sipariş kaydından takip çubuğunun adımını / özel durumunu çıkarır (teknik İngilizce kodlar gösterilmez). */
export function trackState(o: TrackInput): TrackState {
  if (o.status === "CANCELLED") return { kind: "special", tone: "red", label: "İptal Edildi" };
  if (o.status === "RETURNED" || (o.cancelReturnType === "RETURN" && o.cancelReturnStatus === "APPROVED")) {
    return { kind: "special", tone: "orange", label: "İade Sürecinde" };
  }
  if (o.status === "AWAITING_PAYMENT") {
    return { kind: "special", tone: "amber", label: "Ödeme Bekleniyor", hint: "Ödemeniz onaylandığında siparişiniz hazırlanmaya başlar." };
  }
  if (o.status === "PAYMENT_FAILED") return { kind: "special", tone: "red", label: "Ödeme Alınamadı" };

  const labels: string[] = [...TRACK_STEPS];
  if (o.shippingType === "BEYOGLU_MAGAZA_TESLIM") {
    labels[2] = "Hazırlandı";
    labels[3] = "Teslime Hazır";
  }

  const k = `${o.kargonomiStatus ?? ""} ${o.kargonomiStatusLabel ?? ""}`.toLowerCase();
  let current = 0;
  if (o.status === "PENDING") current = 1;
  else if (o.status === "READY_FOR_PICKUP") current = 3;
  else if (o.status === "SHIPPED") current = /dağıtım|distribution|out_for_delivery|courier/.test(k) ? 3 : 2;
  else if (o.status === "DELIVERED") current = 4;
  return { kind: "steps", current, labels };
}
