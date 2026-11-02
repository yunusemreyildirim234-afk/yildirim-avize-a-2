"use client";

import { Clock, X } from "lucide-react";

export default function RecentSearches({
  items,
  onPick,
  onRemove,
  onClear,
}: {
  items: string[];
  onPick: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Son Aramalarınız</h3>
        <button type="button" onClick={onClear} className="text-[11px] font-semibold text-amber-800 hover:underline focus-visible:outline-2 focus-visible:outline-amber-600">
          Temizle
        </button>
      </div>
      <ul>
        {items.map((term) => (
          <li key={term} className="flex items-center hover:bg-amber-50/60">
            <button type="button" onClick={() => onPick(term)} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-800">
              <Clock aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{term}</span>
            </button>
            <button type="button" aria-label={`${term} aramasını kaldır`} onClick={() => onRemove(term)} className="p-2 mr-1 text-zinc-400 hover:text-zinc-700">
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
