"use client";

import { toggleSelection } from "@/lib/filter-chips";

export interface ChipOption {
  key: string;
  label: string;
  count: number;
}

/**
 * Akıllı çoklu filtre çipleri. `selected` boşsa yalnızca "Tümü" aktiftir (liste filtresiz).
 * - Tümü aktifken bir çipe tıklamak yalnızca o çipi seçer (Tümü söner).
 * - Seçili çipe tekrar tıklamak seçimi kaldırır; hiçbiri kalmazsa Tümü yeniden aktif olur.
 * - Tümü'ne tıklamak tüm alt seçimleri temizler.
 */

export default function SmartFilterChips({
  label,
  options,
  selected,
  total,
  onChange,
  allLabel = "Tümü",
}: {
  label: string;
  options: ChipOption[];
  selected: string[];
  total: number;
  onChange: (next: string[]) => void;
  allLabel?: string;
}) {
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-500";
  const allActive = selected.length === 0;

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={allActive} onClick={() => onChange([])} className={`${chip} ${allActive ? on : off}`}>
        {allLabel} <span className="opacity-70">({total})</span>
      </button>
      {options.map((o) => {
        const active = selected.includes(o.key);
        return (
          <button key={o.key} type="button" aria-pressed={active} onClick={() => onChange(toggleSelection(selected, o.key))} className={`${chip} ${active ? on : off}`}>
            {o.label} <span className="opacity-70">({o.count})</span>
          </button>
        );
      })}
    </div>
  );
}
