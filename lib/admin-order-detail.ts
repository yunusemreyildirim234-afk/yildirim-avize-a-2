// Yönetim paneli sipariş detay sayfası (/admin/siparis/[id]) için saf kurallar: bağlantı, ödeme etiketi, hazırlık fişi verisi.
import { orderCode } from "./order-display.ts";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Sipariş detay sayfası yolu; geçersiz kimlikte panel listesine düşer. */
export function adminOrderHref(orderId: string): string {
  return ID_RE.test(orderId) ? `/admin/siparis/${encodeURIComponent(orderId)}` : "/admin?durum=tumu#siparisler";
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === "CREDIT_CARD") return "Kredi Kartı";
  if (method === "BANK_TRANSFER") return "Havale / EFT";
  return "Belirtilmemiş";
}

export interface FisInput {
  id: string;
  createdAt: Date;
  shippingType: string;
  phone?: string | null;
  address?: string | null;
  buyerCityName?: string | null;
  buyerStateName?: string | null;
  orderNote?: string | null;
  paymentMethod?: string | null;
  items: { quantity: number; variationValue?: string | null; title?: string | null }[];
}

export interface FisData {
  code: string;
  isPickup: boolean;
  phone: string;
  address: string;
  note: string | null;
  payment: string;
  items: { title: string; variation: string; quantity: number }[];
}

/** Hazırlık fişi: depo/kargo çalışanı içindir; fiyat, indirim ve toplam bilerek yoktur. */
export function buildFis(o: FisInput, storeAddress: string): FisData {
  const isPickup = o.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const region = [o.buyerCityName, o.buyerStateName].filter(Boolean).join(" / ");
  return {
    code: orderCode(o.id),
    isPickup,
    phone: o.phone?.trim() || "-",
    address: isPickup ? `Mağazadan teslim: ${storeAddress}` : [o.address?.trim(), region].filter(Boolean).join(", ") || "-",
    note: o.orderNote?.trim() || null,
    payment: paymentMethodLabel(o.paymentMethod),
    items: o.items.map((i) => ({ title: i.title?.trim() || "Ürün", variation: i.variationValue?.trim() || "-", quantity: i.quantity })),
  };
}
