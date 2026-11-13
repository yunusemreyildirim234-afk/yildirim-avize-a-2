/** Kuponun kısa indirim etiketi: "%5 indirim" veya "50 ₺ indirim". Saf fonksiyon (DB okumaz); kayıt zaten okunmuş olmalı. */
export function couponDiscountLabel(c: { discountType?: string; discountPercent: number; discountAmount?: number | null }): string {
  const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return c.discountType === "FIXED" && c.discountAmount ? `${fmt(c.discountAmount)} ₺ indirim` : `%${fmt(c.discountPercent)} indirim`;
}
