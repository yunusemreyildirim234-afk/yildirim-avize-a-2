import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/pricing";

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** Admin sipariş satırı dökümü: ürünler toplamı, kupon kodu, kargo (sabit kuraldan) ve indirimler (ürünler + kargo − toplam). Yeni alan çekmez. */
export default function AdminOrderBreakdown({ itemsTotal, totalAmount, couponCode, isPickup, isTransfer = false }: { itemsTotal: number; totalAmount: number; couponCode: string | null; isPickup: boolean; isTransfer?: boolean }) {
  const shipping = isPickup || itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const discounts = Math.max(0, Math.round((itemsTotal + shipping - totalAmount) * 100) / 100);
  // Tür etiketi yalnızca bilinen kaynaklardan: kupon kodu, mağazadan teslim, havale/EFT (tutarlar ayrı hesaplanmaz)
  const kinds = [couponCode ? "kupon" : null, isPickup ? "mağaza" : null, isTransfer ? "havale" : null].filter(Boolean).join(" + ");
  return (
    <dl className="mt-1 text-[11px] text-neutral-500 space-y-0.5 tabular-nums">
      <div className="flex justify-between gap-3"><dt>Ürünler</dt><dd className="whitespace-nowrap">{tl(itemsTotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Kargo</dt><dd className="whitespace-nowrap">{shipping === 0 ? "Ücretsiz" : tl(shipping)}</dd></div>
      {discounts > 0 && <div className="flex justify-between gap-3"><dt>İndirimler{kinds && <span className="font-normal"> ({kinds})</span>}</dt><dd className="whitespace-nowrap">-{tl(discounts)}</dd></div>}
      {couponCode && <div className="flex justify-between gap-3"><dt>Kupon</dt><dd className="font-mono">{couponCode}</dd></div>}
    </dl>
  );
}
