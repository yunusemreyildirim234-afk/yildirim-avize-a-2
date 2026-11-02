import Link from "next/link";
import { ALL_GROUP_KEYS, ORDER_GROUPS, type OrderGroupKey } from "@/lib/orderStatus";

/** Sipariş listesi filtre çipleri. Seçim ?durum= parametresinde saklanır; her çip o gruptaki sipariş adedini gösterir. */
export default function AdminOrderFilters({ selected, counts, total }: { selected: OrderGroupKey[]; counts: Record<OrderGroupKey, number>; total: number }) {
  const href = (keys: OrderGroupKey[]) => `/admin?durum=${keys.length === ALL_GROUP_KEYS.length ? "tumu" : keys.join(",")}#siparisler`;
  const allSelected = selected.length === ALL_GROUP_KEYS.length;
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-700 hover:border-neutral-500";

  return (
    <nav aria-label="Sipariş durumu filtreleri" className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-neutral-100">
      <Link href={href(ALL_GROUP_KEYS)} scroll={false} aria-pressed={allSelected} className={`${chip} ${allSelected ? on : off}`}>
        Tümü <span className="opacity-70">{total}</span>
      </Link>
      {ORDER_GROUPS.map((g) => {
        const active = selected.includes(g.key);
        const next = active ? selected.filter((k) => k !== g.key) : [...selected, g.key];
        return (
          <Link key={g.key} href={href(next)} scroll={false} aria-pressed={active} className={`${chip} ${active ? on : off}`}>
            {g.label} <span className="opacity-70">{counts[g.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
