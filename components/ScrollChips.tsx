"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Tek satırlık yatay şerit: taşma varsa sol/sağ ok düğmeleri görünür, uca varınca ilgili ok gizlenir. Parmakla kaydırma yerel çalışır. */
export default function ScrollChips({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow = "absolute top-0 bottom-0 z-10 flex w-9 min-w-9 items-center bg-gradient-to-r from-neutral-50 from-60% to-transparent text-neutral-800 focus-visible:outline-2 focus-visible:outline-amber-600";

  return (
    <div className="relative">
      <div ref={ref} onScroll={measure} className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {edge.left && (
        <button type="button" aria-label="Sola kaydır" onClick={() => go(-1)} className={`${arrow} left-0 justify-start`}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label="Sağa kaydır" onClick={() => go(1)} className={`${arrow} right-0 justify-end bg-gradient-to-l`}>
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
