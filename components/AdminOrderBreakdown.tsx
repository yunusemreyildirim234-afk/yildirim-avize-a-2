import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/pricing";

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** Admin sipariş satırı dökümü: ürünler toplamı, kupon kodu, kargo (sabit kuraldan) ve indirimler (ürünler + kargo − toplam). Yeni alan çekmez. */
export default function AdminOrderBreakdown({ itemsTotal, totalAmount, couponCode, isPickup }: { itemsTotal: number; totalAmount: number; couponCode: string | null; isPickup: boolean }) {
  const shipping = isPickup || itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const discounts = Math.max(0, Math.round((itemsTotal + shipping - totalAmount) * 100) / 100);
  return (
    <dl className="mt-1 text-[11px] text-neutral-500 space-y-0.5 tabular-nums">
      <div className="flex justify-between gap-3"><dt>Ürünler</dt><dd>{tl(itemsTotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Kargo</dt><dd>{shipping === 0 ? "Ücretsiz" : tl(shipping)}</dd></div>
      {discounts > 0 && <div className="flex justify-between gap-3"><dt>İndirimler</dt><dd>-{tl(discounts)}</dd></div>}
      {couponCode && <div className="flex justify-between gap-3"><dt>Kupon</dt><dd className="font-mono">{couponCode}</dd></div>}
    </dl>
  );
}
