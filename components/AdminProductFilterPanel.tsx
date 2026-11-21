"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ADMIN_SORTS, ADMIN_SORT_LABELS, hasAdminFilters, type AdminFilterState, type AdminSort, type FacetOption, type StockMode } from "@/lib/admin-product-filters";

const STOCK_OPTIONS: { key: StockMode; label: string }[] = [
  { key: "hepsi", label: "Hepsi" },
  { key: "stokta", label: "Sadece stokta" },
  { key: "stoksuz", label: "Stoksuz" },
];

const legend = "block text-[11px] font-bold uppercase tracking-wide text-neutral-600 mb-1.5";
const numInput = "w-full min-h-11 text-xs px-3 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600";

function Facet({ title, options, onToggle }: { title: string; options: FacetOption[]; onToggle: (key: string) => void }) {
  if (options.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className={legend}>{title}</legend>
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.selected}
            onClick={() => onToggle(o.key)}
            className={`min-h-11 md:min-h-9 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-600 ${o.selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-800 hover:border-amber-600"}`}
          >
            {o.name} <span className={o.selected ? "text-neutral-300" : "text-neutral-500"}>({o.count})</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Stok yönetimi sırala + filtrele denetimleri. Mobilde "Filtrele ve Sırala" düğmesiyle açılır; masaüstünde hep açık. */
export default function AdminProductFilterPanel({
  state,
  onChange,
  colors,
  sizes,
  onClearAll,
  anyActive,
}: {
  state: AdminFilterState;
  onChange: (next: AdminFilterState) => void;
  colors: FacetOption[];
  sizes: FacetOption[];
  onClearAll: () => void;
  anyActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };
  const activeCount = [state.renkler.length > 0, state.ebatlar.length > 0, state.fiyatMin !== undefined || state.fiyatMax !== undefined, state.stok !== "hepsi", state.siralama !== "varsayilan"].filter(Boolean).length;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-filter-panel"
        className="md:hidden flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <SlidersHorizontal aria-hidden="true" className="w-4 h-4" /> Filtrele ve Sırala{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div id="admin-filter-panel" className={`${open ? "block" : "hidden"} md:block mt-3 md:mt-0 space-y-4 rounded-xl border border-neutral-200 bg-white p-4`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="admin-siralama" className={legend}>Sırala</label>
            <select
              id="admin-siralama"
              value={state.siralama}
              onChange={(e) => onChange({ ...state, siralama: e.target.value as AdminSort })}
              className="w-full min-h-11 text-xs px-3 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600"
            >
              {ADMIN_SORTS.map((s) => (
                <option key={s} value={s}>{ADMIN_SORT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className={legend}>Stok durumu</legend>
            <div className="flex flex-wrap gap-1.5">
              {STOCK_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={state.stok === o.key}
                  onClick={() => onChange({ ...state, stok: o.key })}
                  className={`min-h-11 md:min-h-9 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-600 ${state.stok === o.key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-800 hover:border-amber-600"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>Fiyat aralığı (₺)</legend>
            <div className="flex items-center gap-2">
              <input aria-label="En düşük fiyat" inputMode="decimal" placeholder="En az" defaultValue={state.fiyatMin ?? ""} key={`min-${state.fiyatMin ?? "x"}`} onBlur={(e) => onChange({ ...state, fiyatMin: num(e.target.value) })} onKeyDown={enter} className={numInput} />
              <span aria-hidden="true" className="text-neutral-400">–</span>
              <input aria-label="En yüksek fiyat" inputMode="decimal" placeholder="En çok" defaultValue={state.fiyatMax ?? ""} key={`max-${state.fiyatMax ?? "x"}`} onBlur={(e) => onChange({ ...state, fiyatMax: num(e.target.value) })} onKeyDown={enter} className={numInput} />
            </div>
          </fieldset>
        </div>
        <Facet title="Renk" options={colors} onToggle={(k) => onChange({ ...state, renkler: toggle(state.renkler, k) })} />
        <Facet title="Ebat" options={sizes} onToggle={(k) => onChange({ ...state, ebatlar: toggle(state.ebatlar, k) })} />
        {(anyActive || hasAdminFilters(state) || state.siralama !== "varsayilan") && (
          <button type="button" onClick={onClearAll} className="min-h-11 md:min-h-9 text-xs font-semibold text-amber-800 hover:underline focus-visible:outline-2 focus-visible:outline-amber-600">
            Süzgeçleri temizle
          </button>
        )}
      </div>
    </div>
  );
}
