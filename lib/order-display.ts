import { BANK_ORDER_HOLD_HOURS } from "./stock-rules.ts";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "./pricing.ts";

/** Havale siparişinin son ödeme (otomatik iptal) zamanı: sipariş anı + BANK_ORDER_HOLD_HOURS. */
export function bankPaymentDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + BANK_ORDER_HOLD_HOURS * 3_600_000);
}

/** İstanbul saatiyle "12 Kasım 2026 14:30". */
export function formatIstanbul(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Tutar dökümü: ürünler + kargo - toplam = indirimlerin toplam farkı (saklı olmayan ayrım uydurulmaz). */
export function orderBreakdown(itemsSum: number, shipping: number, total: number): { itemsSum: number; shipping: number; discount: number; total: number } {
  const discount = Math.max(0, Math.round((itemsSum + shipping - total) * 100) / 100);
  return { itemsSum, shipping, discount, total };
}

/**
 * "Sipariş Kodu": sipariş kimliğinin ilk 8 hanesi. Havale açıklamasına yazılan, e-postalarda, onay sayfasında ve
 * yönetim panelinde gösterilen kısa kod budur (tam kimlik yalnızca bağlantılarda kullanılır).
 */
export const ORDER_CODE_LENGTH = 8;
export function orderCode(orderId: string): string {
  return orderId.slice(0, ORDER_CODE_LENGTH);
}

export const formatTl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** Kargo ücreti sabit kuraldan: mağazadan teslim veya eşik üstü 0, aksi SHIPPING_COST (siparişte ayrı saklanmaz). */
export function orderShippingFee(itemsSum: number, shippingType: string): number {
  return shippingType === "BEYOGLU_MAGAZA_TESLIM" || itemsSum >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

/** Sipariş kalemlerinden döküm (onay sayfası ve e-postalar aynı hesabı kullanır). */
export function breakdownOf(items: { unitPrice: number; quantity: number }[], shippingType: string, total: number) {
  const itemsSum = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  return orderBreakdown(itemsSum, orderShippingFee(itemsSum, shippingType), total);
}

export interface BreakdownRow {
  label: string;
  value: string;
  kind: "plain" | "discount" | "total";
}

/** Döküm satırları (metin): Ürünler, Kargo, (varsa) İndirimler, Toplam. Onay sayfası ve e-postalar bu tek listeden çizilir. */
export function breakdownRows(b: { itemsSum: number; shipping: number; discount: number; total: number }): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    { label: "Ürünler", value: formatTl(b.itemsSum), kind: "plain" },
    { label: "Kargo", value: b.shipping === 0 ? "Ücretsiz" : formatTl(b.shipping), kind: "plain" },
  ];
  if (b.discount > 0) rows.push({ label: "İndirimler", value: `-${formatTl(b.discount)}`, kind: "discount" });
  rows.push({ label: "Toplam", value: formatTl(b.total), kind: "total" });
  return rows;
}

/** Teslimat adresi metni: mağazadan teslimde mağaza metni, adrese teslimde "adres, ilçe / il". */
export function deliveryAddressText(o: { shippingType: string; address?: string | null; buyerCityName?: string | null; buyerStateName?: string | null }, storeAddress: string): string {
  if (o.shippingType === "BEYOGLU_MAGAZA_TESLIM") return `Mağazadan teslim: ${storeAddress}`;
  const region = [o.buyerCityName, o.buyerStateName].filter(Boolean).join(" / ");
  return [o.address?.trim(), region].filter(Boolean).join(", ") || "-";
}

/** Müşterinin "Siparişiniz Alındı" bildirimindeki bağlantı; sipariş silinirken bildirim bu bağlantıyla bulunup silinir. */
export const orderNotificationLink = (orderId: string) => `/siparis-onay/${orderId}`;

/**
 * Kalemin sipariş anındaki ad/renk kaydı varsa görünen ad onunla değişir (ürün sonradan yeniden adlandırılsa da sipariş eski adı gösterir);
 * boşsa (eski siparişler) canlı kayıt kalır. Görsel ve bağlantı canlı üründen gelmeye devam eder.
 */
export function withStoredNames<I extends { productTitle?: string | null; variationLabel?: string | null; variation: { variationValue: string; product: { title: string } } }>(i: I): I {
  return {
    ...i,
    variation: { ...i.variation, variationValue: i.variationLabel ?? i.variation.variationValue, product: { ...i.variation.product, title: i.productTitle ?? i.variation.product.title } },
  };
}
