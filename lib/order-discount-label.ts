/**
 * İndirim satırının etiketi (yalnızca gösterim): saklı olmayan ayrım uydurulmaz.
 * Kupon varsa kuponlu, aksi halde havale siparişinde "Havale/EFT indirimi (%x)", mağazadan tesliminde mağaza indirimi.
 */
export function discountLabel(
  o: { paymentMethod?: string | null; shippingType: string; couponCode?: string | null },
  itemsSum: number,
  discount: number,
): string {
  if (o.couponCode) return `İndirimler (kupon: ${o.couponCode})`;
  const pct = itemsSum > 0 ? Math.round((discount / itemsSum) * 1000) / 10 : 0;
  const pctText = pct > 0 ? ` (%${pct.toLocaleString("tr-TR")})` : "";
  if (o.paymentMethod === "BANK_TRANSFER") return `Havale/EFT indirimi${pctText}`;
  if (o.shippingType === "BEYOGLU_MAGAZA_TESLIM") return `Mağazadan teslim indirimi${pctText}`;
  return "İndirimler";
}
