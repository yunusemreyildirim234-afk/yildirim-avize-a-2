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


// ---- Sipariş durum grupları (yönetim paneli listesi, sayaçlar ve filtre çipleri bu tek tanımdan beslenir) ----

/** Ciro ve "geçerli sipariş" sayaçlarına girmeyen durumlar: ödemesi tamamlanmamış, iptal ve iade edilmiş siparişler. */
export const UNCOUNTED_STATUSES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING_NEW", "CANCELLED", "RETURNED"];

/** Ödemesi alınmış, iptal/iade edilmemiş sipariş mi? */
export const isCountedOrder = (status: string) => !UNCOUNTED_STATUSES.includes(status);

export interface GroupInput {
  status: string;
  cancelReturnStatus?: string | null;
}

export const ORDER_GROUPS = [
  // PENDING: ödemesi alınmış, hazırlanıyor; PENDING_NEW: havale onayı bekliyor (yönetici işlemi gerektirdiği için burada)
  { key: "yeni", label: "Yeni gelen", test: (o: GroupInput) => o.status === "PENDING" || o.status === "PENDING_NEW" },
  { key: "hazir", label: "Teslime hazır", test: (o: GroupInput) => o.status === "READY_FOR_PICKUP" },
  { key: "kargoda", label: "Kargo sürecinde", test: (o: GroupInput) => o.status === "SHIPPED" },
  { key: "teslim", label: "Teslim edilen", test: (o: GroupInput) => o.status === "DELIVERED" },
  { key: "iptal", label: "İptal", test: (o: GroupInput) => o.status === "CANCELLED" },
  // Not: iade onayında sipariş, ürün henüz gelmeden RETURNED yapılır; "iade edilen" bu yüzden ürünün geri geldiğini garanti etmez.
  { key: "iade", label: "İade edilen", test: (o: GroupInput) => o.status === "RETURNED" },
  // Müşteri iptal/iade talebi var ve henüz karara bağlanmamış (diğer gruplarla çakışabilir)
  { key: "talep", label: "Talep bekleyen", test: (o: GroupInput) => o.cancelReturnStatus === "PENDING" },
  { key: "odeme", label: "Ödeme bekliyor / başarısız", test: (o: GroupInput) => o.status === "AWAITING_PAYMENT" || o.status === "PAYMENT_FAILED" },
] as const;

export type OrderGroupKey = (typeof ORDER_GROUPS)[number]["key"];
export const ALL_GROUP_KEYS: OrderGroupKey[] = ORDER_GROUPS.map((g) => g.key);

/** ?durum= yokken açılışta seçili gruplar: iptal, iade, teslim edilen ve ödeme bekleyenler gizlidir. */
export const DEFAULT_GROUP_KEYS: OrderGroupKey[] = ["yeni", "hazir", "kargoda", "talep"];

/** ?durum= değerini seçili grup anahtarlarına çevirir. Parametre yoksa varsayılan gruplar; "tumu" (veya boş değer) = "Tümü" (filtre yok, boş dizi). */
export function parseGroupParam(param: string | undefined): OrderGroupKey[] {
  if (param === undefined) return DEFAULT_GROUP_KEYS;
  if (!param || param === "tumu") return [];
  const wanted = param.split(",").map((k) => k.trim());
  return ALL_GROUP_KEYS.filter((k) => wanted.includes(k));
}

/** Seçim boşsa (Tümü) her sipariş görünür; değilse seçili gruplardan en az birine giren sipariş. */
export function matchesGroups(o: GroupInput, keys: readonly OrderGroupKey[]): boolean {
  return keys.length === 0 || ORDER_GROUPS.some((g) => keys.includes(g.key) && g.test(o));
}
