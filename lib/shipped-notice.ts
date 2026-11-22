// "Kargoya Verildi" geçişinde müşteriye gidecek bildirim/e-posta içeriği (saf). Takip kodu yoksa veya mağaza teslimiyse null.
import { carrierDisplayName } from "@/lib/carrier-links";

export interface ShippedNotice {
  carrier: string;
  tracking: string;
  /** "code": takip kodu; "barcode": takip kodu yok, yalnız gönderi barkodu (e-posta ve bildirim etiketi buna göre); "none": zorla geçiş, ikisi de yok (takip satırı yazılmaz) */
  trackingKind: "code" | "barcode" | "none";
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
    message: (orderId) => `#${orderId.slice(0, 8)}: Siparişiniz kargoya verildi. Kargo: ${carrier} • ${o.shippingTrackingCode ? "Takip No" : "Gönderi barkodu"}: ${tracking}`,
    link: `/kargo-takip?code=${encodeURIComponent(tracking)}`,
  };
}

/** Zorla "Kargoya Verildi" (gerçek takip kodu yok): kod/barkod varsa olağan bildirim, hiçbiri yoksa takip satırsız bildirim. Yalnız standart kargo. */
export function buildShippedNoticeForced(o: Parameters<typeof buildShippedNotice>[0]): ShippedNotice | null {
  const normal = buildShippedNotice(o);
  if (normal || o.shippingType !== "STANDART_KARGO") return normal;
  const carrier = carrierDisplayName(o.shippingProviderName);
  return {
    carrier,
    tracking: "",
    trackingKind: "none",
    message: (orderId) => `#${orderId.slice(0, 8)}: Siparişiniz kargoya verildi. Kargo: ${carrier}`,
    link: "/giris#siparisler",
  };
}
