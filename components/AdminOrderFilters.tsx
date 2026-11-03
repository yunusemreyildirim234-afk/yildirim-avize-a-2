import Link from "next/link";
import { ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS, ORDER_GROUPS, type OrderGroupKey } from "@/lib/orderStatus";
import { chipState, nextParam } from "@/lib/filter-chips";

/**
 * Sipariş listesi filtre çipleri. Durum ?durum= parametresindedir:
 * - parametre yok → "aktif işler" (Yeni gelen + Teslime hazır + Kargo sürecinde + Talep bekleyen), "Tümü" yanmaz;
 * - durum=tumu → bütün gruplar seçili, "Tümü" yanık;
 * - diğer → özel seçim (virgülle ayrılmış grup anahtarları).
 * Tıklama mantığı saf fonksiyondadır (lib/filter-chips.ts → nextParam). Sunucu bileşenidir; ilk render ile aynı küme kullanılır.
 */
export default function AdminOrderFilters({ param, counts, total }: { param: string | undefined; counts: Record<OrderGroupKey, number>; total: number }) {
  const { mode, keys } = chipState(param, ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS);
  const href = (clicked: OrderGroupKey | "tumu") => {
    const next = nextParam(param, clicked, ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS);
    return `/admin${next === undefined ? "" : `?durum=${next}`}#siparisler`;
  };
  const allActive = mode === "all";
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-500";

  return (
    <div className="border-b border-neutral-100">
      <nav aria-label="Sipariş durumu filtreleri" className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Link href={href("tumu")} scroll={false} aria-pressed={allActive} className={`${chip} ${allActive ? on : off}`}>
          Tümü <span className="opacity-70">{total}</span>
        </Link>
        {ORDER_GROUPS.map((g) => {
          // "Tümü" modunda grup çipleri yanmaz: tıklamak yalnızca o grubu seçer
          const active = mode !== "all" && keys.includes(g.key);
          return (
            <Link key={g.key} href={href(g.key)} scroll={false} aria-pressed={active} className={`${chip} ${active ? on : off}`}>
              {g.label} <span className="opacity-70">{counts[g.key]}</span>
            </Link>
          );
        })}
      </nav>
      {mode === "default" && (
        <p className="px-6 pb-3 -mt-1 text-[11px] text-neutral-500">Aktif siparişler gösteriliyor. İptal, iade ve teslim edilenleri görmek için çiplere tıklayın.</p>
      )}
    </div>
  );
}
