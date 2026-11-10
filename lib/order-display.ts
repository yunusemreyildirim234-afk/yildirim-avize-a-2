import { BANK_ORDER_HOLD_HOURS } from "./stock-rules.ts";

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
