import Link from "next/link";
import { Check } from "lucide-react";
import { ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS, ORDER_GROUPS, type OrderGroupKey } from "@/lib/orderStatus";
import { chipState, nextParam } from "@/lib/filter-chips";
import { DATE_PRESETS, DATE_PRESET_LABELS, MAX_ORDER_QUERY, filterQuery, type OrderFilterParams } from "@/lib/admin-order-search";

/**
 * Sipariş listesi filtre çipleri. Durum ?durum= parametresindedir:
 * - parametre yok → "aktif işler" (Yeni gelen + Teslime hazır + Kargo sürecinde + Talep bekleyen), "Tümü" yanmaz;
 * - durum=tumu → bütün gruplar seçili, "Tümü" yanık;
 * - diğer → özel seçim (virgülle ayrılmış grup anahtarları).
 * Tıklama mantığı saf fonksiyondadır (lib/filter-chips.ts → nextParam). Sunucu bileşenidir; ilk render ile aynı küme kullanılır.
 */
export default function AdminOrderFilters({ param, counts, total, filters }: { param: string | undefined; counts: Record<OrderGroupKey, number>; total: number; filters: OrderFilterParams }) {
  const { mode, keys } = chipState(param, ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS);
  const href = (clicked: OrderGroupKey | "tumu") => {
    const next = nextParam(param, clicked, ALL_GROUP_KEYS, DEFAULT_GROUP_KEYS);
    return `/admin${filterQuery({ ...filters, durum: next })}#siparisler`;
  };
  const allActive = mode === "all";
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-500";

  const field = "min-h-10 max-sm:w-full max-sm:min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-600";
  const filtered = Boolean(filters.q?.trim() || filters.tarih);

  return (
    <div className="border-b border-neutral-100">
      {/* Arama ve tarih aralığı: sunucuda süzülür (GET); durum çipleriyle kesişir, sayaçlar aynı kümeden çıkar */}
      <form action="/admin#siparisler" method="get" role="search" aria-label="Sipariş ara" className="flex flex-wrap items-end gap-2 px-6 pt-4 max-sm:grid max-sm:grid-cols-2 max-sm:items-start">
        {param !== undefined && <input type="hidden" name="durum" value={param} />}
        <label className="flex min-w-[14rem] max-sm:min-w-0 max-sm:col-span-2 flex-1 flex-col gap-1 text-[11px] font-semibold text-neutral-600">
          Ara (sipariş kodu, ad, e-posta, telefon)
          <input type="search" name="q" defaultValue={filters.q ?? ""} maxLength={MAX_ORDER_QUERY} autoComplete="off" className={field} />
        </label>
        <label className="flex flex-col max-sm:col-span-2 gap-1 text-[11px] font-semibold text-neutral-600">
          Tarih
          <select name="tarih" defaultValue={filters.tarih ?? ""} className={field}>
            <option value="">Tüm zamanlar</option>
            {DATE_PRESETS.map((k) => (
              <option key={k} value={k}>{DATE_PRESET_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col max-sm:min-w-0 gap-1 text-[11px] font-semibold text-neutral-600">
          Başlangıç <span className="font-normal text-neutral-400">(özel aralık)</span>
          <input type="date" name="bas" defaultValue={filters.bas ?? ""} className={field} />
        </label>
        <label className="flex flex-col max-sm:min-w-0 gap-1 text-[11px] font-semibold text-neutral-600">
          Bitiş <span className="font-normal text-neutral-400">(özel aralık)</span>
          <input type="date" name="bit" defaultValue={filters.bit ?? ""} className={field} />
        </label>
        <button type="submit" className="min-h-10 max-sm:col-span-2 rounded-lg bg-neutral-900 px-4 text-xs font-bold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600">Ara</button>
        {filtered && (
          <Link href={`/admin${filterQuery({ durum: param })}#siparisler`} scroll={false} className="inline-flex min-h-10 max-sm:col-span-2 items-center px-2 text-xs font-semibold text-neutral-600 underline hover:text-amber-700">
            Aramayı ve tarihi temizle
          </Link>
        )}
      </form>
      <nav aria-label="Sipariş durumu filtreleri" className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Link href={href("tumu")} scroll={false} aria-pressed={allActive} className={`${chip} ${allActive ? on : off}`}>
          {allActive && <Check aria-hidden="true" className="h-3 w-3" />}Tümü <span className="opacity-70">{total}</span>
        </Link>
        {ORDER_GROUPS.map((g) => {
          // "Tümü" modunda grup çipleri yanmaz: tıklamak yalnızca o grubu seçer
          const active = mode !== "all" && keys.includes(g.key);
          return (
            <Link key={g.key} href={href(g.key)} scroll={false} aria-pressed={active} className={`${chip} ${active ? on : off}`}>
              {active && <Check aria-hidden="true" className="h-3 w-3" />}{g.label} <span className="opacity-70">{counts[g.key]}</span>
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
