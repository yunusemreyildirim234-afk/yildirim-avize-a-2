// "Kargoya Verildi" geçişinde müşteriye gidecek bildirim/e-posta içeriği (saf). Takip kodu yoksa veya mağaza teslimiyse null.
import { carrierDisplayName } from "@/lib/carrier-links";

export interface ShippedNotice {
  carrier: string;
  tracking: string;
  /** "code": takip kodu; "barcode": takip kodu yok, yalnız gönderi barkodu (e-posta etiketi buna göre) */
  trackingKind: "code" | "barcode";
  message: (orderId: string) => string;
  link: string;
}

export function buildShippedNotice(o: {
  shippingType: string;
  shippingTrackingCode: string | null;
  shippingBarcode: string | null;
  shippingProviderName: string | null;
}): ShippedNotice | null {
  if (o.shippingType !== "STANDART_KARGO") return null;
  const tracking = o.shippingTrackingCode || o.shippingBarcode;
  if (!tracking) return null;
  const carrier = carrierDisplayName(o.shippingProviderName);
  return {
    carrier,
    tracking,
    trackingKind: o.shippingTrackingCode ? "code" : "barcode",
    message: (orderId) => `#${orderId.slice(0, 8)}: Siparişiniz kargoya verildi. Kargo: ${carrier} • Takip No: ${tracking}`,
    link: `/kargo-takip?code=${encodeURIComponent(tracking)}`,
  };
}
