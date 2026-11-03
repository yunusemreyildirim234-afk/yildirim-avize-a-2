// GA4 e-ticaret dataLayer olayları için SAF kurucular (ağ/depolama yok). Para birimi TRY. Fiyat hesabı yapmaz; yalnızca verilen değerleri biçimler.

export interface GaItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_brand?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}
export interface GtmEventPayload {
  event: string;
  ecommerce: Record<string, unknown>;
}

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function gaItem(i: { id: string; name: string; price: number; quantity?: number; category?: string | null; brand?: string | null; variant?: string | null }): GaItem {
  return {
    item_id: i.id,
    item_name: i.name,
    ...(i.category ? { item_category: i.category } : {}),
    ...(i.brand ? { item_brand: i.brand } : {}),
    ...(i.variant ? { item_variant: i.variant } : {}),
    price: round2(i.price),
    quantity: i.quantity ?? 1,
  };
}

const sum = (items: GaItem[]) => round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
const withItems = (event: string, items: GaItem[]): GtmEventPayload => ({ event, ecommerce: { currency: "TRY", value: sum(items), items } });

export const viewItemEvent = (items: GaItem[]) => withItems("view_item", items);
export const addToCartEvent = (items: GaItem[]) => withItems("add_to_cart", items);
export const beginCheckoutEvent = (items: GaItem[]) => withItems("begin_checkout", items);

/** value = sipariş toplamı (Order.totalAmount); transaction_id = sipariş no. */
export function purchaseEvent(o: { id: string; total: number; shipping: number; paymentType: string | null; coupon?: string | null; items: GaItem[] }): GtmEventPayload {
  return {
    event: "purchase",
    ecommerce: {
      transaction_id: o.id,
      currency: "TRY",
      value: round2(o.total),
      shipping: round2(o.shipping),
      ...(o.coupon ? { coupon: o.coupon } : {}),
      ...(o.paymentType ? { payment_type: o.paymentType } : {}),
      items: o.items,
    },
  };
}

/** Ödemesi alınmamış/başarısız/iptal/iade siparişler için purchase atılmaz. Kartlı ödeme onaylanınca durum AWAITING_PAYMENT'tan çıkar; havale siparişi PENDING_NEW ile oluşur. */
export const PURCHASE_EXCLUDED_STATUSES = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "CANCELLED", "RETURNED"];
export const isPurchasable = (status: string) => !PURCHASE_EXCLUDED_STATUSES.includes(status);

/** Aynı sipariş için purchase yalnızca bir kez: tarayıcıda (localStorage) sipariş başına işaret. */
export const purchaseOnceKey = (orderId: string) => `ya-gtm-purchase-${orderId}`;

export const isAdminPath = (path: string) => /^\/admin(\/|$)/.test(path);
export const isGtmId = (v: string | undefined | null): v is string => /^GTM-[A-Z0-9]{4,12}$/.test(v ?? "");
