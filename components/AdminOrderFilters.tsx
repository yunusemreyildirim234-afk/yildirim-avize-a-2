import Link from "next/link";
import { ORDER_GROUPS, type OrderGroupKey } from "@/lib/orderStatus";
import { toggleSelection } from "@/lib/filter-chips";

/**
 * Sipariş listesi filtre çipleri. Seçim ?durum= parametresinde saklanır; her çip o gruptaki sipariş adedini gösterir.
 * ?durum= yokken varsayılan olarak Yeni gelen + Teslime hazır + Kargo sürecinde + Talep bekleyen seçilidir; "Tümü" (?durum=tumu) hepsini açar.
 * `selected` boşsa yalnızca "Tümü" aktiftir ve tüm siparişler listelenir. Bir çipe tıklamak Tümü'nü söndürüp yalnızca
 * o grubu seçer; seçili çipe tekrar tıklamak kaldırır (hiçbiri kalmazsa Tümü yeniden aktif olur); Tümü alt seçimleri temizler.
 */
export default function AdminOrderFilters({ selected, counts, total }: { selected: OrderGroupKey[]; counts: Record<OrderGroupKey, number>; total: number }) {
  const href = (keys: OrderGroupKey[]) => `/admin?durum=${keys.length === 0 ? "tumu" : keys.join(",")}#siparisler`;
  const allActive = selected.length === 0;
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-500";

  return (
    <nav aria-label="Sipariş durumu filtreleri" className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-neutral-100">
      <Link href={href([])} scroll={false} aria-pressed={allActive} className={`${chip} ${allActive ? on : off}`}>
        Tümü <span className="opacity-70">{total}</span>
      </Link>
      {ORDER_GROUPS.map((g) => {
        const active = selected.includes(g.key);
        return (
          <Link key={g.key} href={href(toggleSelection(selected, g.key))} scroll={false} aria-pressed={active} className={`${chip} ${active ? on : off}`}>
            {g.label} <span className="opacity-70">{counts[g.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
