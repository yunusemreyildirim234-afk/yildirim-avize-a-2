"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Yatay kaydırmalı koleksiyon satırı: mobilde parmakla kaydırma (scroll-snap), masaüstünde sağ/sol ok düğmeleri.
 * Kartlar sunucuda üretilip children olarak gelir; 4 karta kadar görünüm eski ızgarayla aynıdır (ok yok).
 */
export default function CollectionsRow({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: d * el.clientWidth * 0.75, behavior: "smooth" });
  };
  const arrow = "hidden lg:flex absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/95 border border-zinc-300 text-zinc-800 shadow-sm hover:border-amber-600 hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600";
  return (
    <div className="relative">
      <div ref={ref} role="list" className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {count > 4 && (
        <>
          <button type="button" onClick={() => scroll(-1)} aria-label="Önceki koleksiyonlar" className={`${arrow} -left-5`}>
            <ChevronLeft aria-hidden="true" className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Sonraki koleksiyonlar" className={`${arrow} -right-5`}>
            <ChevronRight aria-hidden="true" className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
