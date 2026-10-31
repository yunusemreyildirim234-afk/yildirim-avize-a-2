import { prisma } from "@/lib/db";

const BASE_URL = (process.env.KARGONOMI_API_URL || process.env.KARGONOMI_BASE_URL || "https://app.kargonomi.com.tr/api/v1").replace(/\/$/, "");

// Kargonomi kargo firması kimlikleri (-1: otomatik, 3: Kolay Gelsin, 4: Aras, 5: Sürat, 6: Hepsijet, 7: PTT)
const CARRIERS: Record<string, { id: number; name: string }> = {
  ARAS: { id: 4, name: "Aras Kargo" },
};
const carrier = () => CARRIERS[(process.env.KARGONOMI_DEFAULT_CARRIER || "ARAS").toUpperCase()] ?? CARRIERS.ARAS;

export const KARGONOMI_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  ready: "İşleme Hazır",
  webservice_shipment_started: "Kargo Teslim Sürecinde",
  webservice_shipment_delivered: "Kargo Teslim Edildi",
  cancelled: "İptal Edildi",
};

export interface KargonomiPackage {
  content: string;
  barcode?: string;
  desi: number;
}

export interface KargonomiShipmentInput {
  buyer_name: string;
  buyer_email?: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_state_id: number;
  buyer_city_id: number;
  packages: KargonomiPackage[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class KargonomiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function kargonomiHeaders(): Record<string, string> {
  const token = process.env.KARGONOMI_API_KEY || process.env.KARGONOMI_API_TOKEN;
  if (!token) throw new KargonomiError("KARGONOMI_API_KEY tanımlı değil.", 500);
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export async function kargonomiRaw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...kargonomiHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

async function request(path: string, init: RequestInit = {}): Promise<Json> {
  const res = await kargonomiRaw(path, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.errors ? Object.values(data.errors).flat().join(" ") : "";
    throw new KargonomiError(detail || data?.message || `Kargonomi hatası (${res.status})`, res.status);
  }
  return data;
}

export const listStates = () => request("/states");
export const listCities = (stateId: number) => request(`/cities/${stateId}`);
export const getShipment = (id: number) => request(`/shipments/${id}`);
export const listWarehouses = () => request("/warehouses");

export async function countShipments(): Promise<number> {
  const data = await request("/shipments?per_page=1");
  return Number(data?.meta?.total ?? 0);
}

export function createKargonomiShipment(input: KargonomiShipmentInput) {
  const env = process.env;
  // Depo kimliği tanımlıysa gönderici bilgileri Kargonomi depo kaydından alınır (sender_* alanları gerekmez)
  const warehouseId = Number(env.KARGONOMI_WAREHOUSE_ID);
  const sender = warehouseId
    ? { warehouse_id: warehouseId }
    : {
        sender_name: env.KARGONOMI_SENDER_NAME,
        sender_email: env.KARGONOMI_SENDER_EMAIL,
        sender_phone: env.KARGONOMI_SENDER_PHONE,
        sender_tax_number: env.KARGONOMI_SENDER_TAX_NUMBER,
        sender_tax_place: env.KARGONOMI_SENDER_TAX_PLACE,
        sender_address: env.KARGONOMI_SENDER_ADDRESS,
        sender_state_id: Number(env.KARGONOMI_SENDER_STATE_ID),
        sender_city_id: Number(env.KARGONOMI_SENDER_CITY_ID),
      };
  return request("/shipments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Taşıyıcı Aras Kargo'ya sabitlenir (otomatik seçim yerine)
    body: JSON.stringify({ shipment: { ...input, ...sender, shipping_provider_id: carrier().id, carrier_code: "ARAS" } }),
  });
}

function unwrap(payload: Json): Json {
  return payload?.shipment ?? payload?.data ?? payload;
}

function statusFields(s: Json) {
  const status: string = s.status || "draft";
  return {
    kargonomiStatus: status,
    kargonomiStatusLabel: s.status_label || KARGONOMI_STATUS_LABELS[status] || status,
    shippingTrackingCode: s.shipping_webservice_tracking_code ?? undefined,
    shippingBarcode: s.shipping_webservice_barcode ?? s.shipment_packages?.[0]?.barcode ?? undefined,
    barcodeUrl: s.barcode_url ?? s.label_url ?? s.shipment_packages?.[0]?.barcode_url ?? undefined,
  };
}

/** Barkod PDF'i: Kargonomi bağlantı döndürdüyse o, yoksa yönetici korumalı barkod vekil rotası. */
const barcodeLink = (orderId: string, url?: string | null) => url || `/api/admin/kargonomi/barcode?orderId=${orderId}`;

/**
 * Siparişe ait Kargonomi (Aras Kargo) gönderisini oluşturur ve sonucu siparişe yazar.
 * `regenerate`: mevcut gönderi bağlantısı bırakılıp yeni gönderi açılır (eski kayıt Kargonomi panelinden iptal edilmelidir).
 */
export async function createShipmentForOrder(orderId: string, opts: { regenerate?: boolean } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: { include: { variation: { include: { product: true } } } } },
  });
  if (!order) throw new KargonomiError("Sipariş bulunamadı.", 404);
  if (order.kargonomiShipmentId && !opts.regenerate) throw new KargonomiError("Bu sipariş için gönderi zaten oluşturulmuş.", 409);

  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
  // Ürün adedine göre desi (adet başına 2), en az 2; sipariş için tanımlı desi daha yüksekse o kullanılır
  const desi = Math.max(2, totalQty * 2, order.packageDesi ?? 0);

  const created = await createKargonomiShipment({
    buyer_name: order.user.name,
    buyer_email: order.user.email,
    buyer_phone: (order.phone || "").replace(/[^0-9]/g, "").replace(/^(90|0)/, "").slice(-10),
    buyer_address: order.address || "",
    buyer_state_id: order.buyerStateId ?? 34,
    buyer_city_id: order.buyerCityId ?? 425,
    packages: [
      {
        content: "Avize / Aydınlatma Malzemesi",
        barcode: `YA-${order.id.slice(0, 8).toUpperCase()}`,
        desi,
      },
    ],
  });

  const shipment = unwrap(created);
  if (!shipment?.id) throw new KargonomiError("Kargonomi gönderi kimliği döndürmedi.", 502);

  const fields = statusFields(shipment);
  return prisma.order.update({
    where: { id: order.id },
    data: {
      kargonomiShipmentId: Number(shipment.id),
      ...fields,
      shippingBarcode: fields.shippingBarcode ?? `YA-${order.id.slice(0, 8).toUpperCase()}`,
      barcodeUrl: barcodeLink(order.id, fields.barcodeUrl),
      shippingProviderId: carrier().id,
      shippingProviderName: carrier().name,
      packageDesi: desi,
    },
  });
}

/** Gönderinin güncel durumunu Kargonomi'den çekip siparişe yansıtır. */
export async function refreshOrderShipment(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.kargonomiShipmentId) throw new KargonomiError("Siparişin Kargonomi gönderisi yok.", 404);

  const shipment = unwrap(await getShipment(order.kargonomiShipmentId));
  const { barcodeUrl, ...fields } = statusFields(shipment);
  return prisma.order.update({ where: { id: order.id }, data: { ...fields, ...(barcodeUrl ? { barcodeUrl } : {}) } });
}
