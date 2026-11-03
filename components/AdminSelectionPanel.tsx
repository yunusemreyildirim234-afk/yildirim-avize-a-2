"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { CHIP_LIMIT, isOffscreen, visibleChips } from "@/lib/admin-selection";

export interface SelChip { id: string; label: string }

/** prefers-reduced-motion'a saygılı kaydırma. */
export function scrollToRow(id: string) {
  const el = document.getElementById(`ap-${id}`);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  return true;
}

/**
 * Yapışık "Seçilenler" çubuğu: sabit yükseklikte (her zaman görünür, açılıp kapanınca liste zıplamaz). Çipler, "Seçtiğim yere dön" ve
 * "Seçimi temizle" çubukta; tüm çipler ve toplu işlemler (children) çubuğun ALTINDA açılan katmanda (akışta yer kaplamaz).
 */
export default function AdminSelectionPanel({
  chips,
  lastId,
  onRemove,
  onClear,
  onChipClick,
  children,
}: {
  chips: SelChip[];
  lastId: string | null;
  onRemove: (id: string) => void;
  onClear: () => void;
  onChipClick: (id: string) => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [top, setTop] = useState(0);
  const [away, setAway] = useState(false);
  const count = chips.length;

  // Site başlığı yapışıksa panel onun hemen altında durur
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector("header");
      const pos = h ? getComputedStyle(h).position : "";
      setTop(h && (pos === "sticky" || pos === "fixed") ? Math.round(h.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Son seçilen satır ekran dışındaysa "Seçtiğim yere dön" görünür
  useEffect(() => {
    if (!lastId) return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.getElementById(`ap-${lastId}`);
        setAway(el ? isOffscreen(el.getBoundingClientRect(), window.innerHeight, top + 48) : false);
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [lastId, top]);

  // Escape açık katmanı kapatır
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const inline = visibleChips(chips, false);
  const full = visibleChips(chips, all);
  const isOpen = open && count > 0;

  const chip = (c: SelChip) => (
    <li key={c.id} className="inline-flex items-center shrink-0 rounded-full bg-white border border-amber-300 text-[11px] text-neutral-800">
      <button type="button" onClick={() => onChipClick(c.id)} className="pl-2.5 pr-1 py-1 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600 rounded-l-full">
        {c.label}
      </button>
      <button type="button" aria-label={`${c.label} seçimden çıkar`} onClick={() => onRemove(c.id)} className="px-1.5 py-1 text-neutral-500 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-amber-600 rounded-r-full">
        <X aria-hidden="true" className="w-3 h-3" />
      </button>
    </li>
  );

  return (
    <div role="region" aria-label="Seçilen ürünler" style={{ top }} className="sticky z-40 bg-amber-50 border-y border-amber-200">
      <div className="flex items-center gap-2 px-4 sm:px-6 h-12 text-xs">
        {count === 0 ? (
          <span role="status" aria-live="polite" className="text-neutral-500">Toplu işlem için ürünleri işaretleyin.</span>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls="admin-selection-detail"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 min-h-11 shrink-0 font-bold text-amber-950 focus-visible:outline-2 focus-visible:outline-amber-600 rounded-md"
            >
              <span role="status" aria-live="polite">{count} ürün seçili</span>
              <ChevronDown aria-hidden="true" className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <ul aria-label="Seçili ürünler" className="hidden sm:flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto py-1">
              {inline.shown.map(chip)}
              {inline.more > 0 && (
                <li className="shrink-0">
                  <button type="button" onClick={() => { setOpen(true); setAll(true); }} className="text-[11px] font-semibold text-amber-800 hover:underline px-1">
                    +{inline.more} daha
                  </button>
                </li>
              )}
            </ul>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {away && lastId && (
                <button type="button" onClick={() => scrollToRow(lastId)} className="min-h-11 px-3 rounded-lg bg-neutral-900 hover:bg-amber-600 text-white font-semibold">
                  Seçtiğim yere dön
                </button>
              )}
              <button type="button" onClick={() => { onClear(); setOpen(false); setAll(false); }} className="min-h-11 px-2 font-semibold text-amber-800 hover:underline">
                Seçimi temizle
              </button>
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <div id="admin-selection-detail" className="absolute left-0 right-0 top-full max-h-[70vh] overflow-y-auto bg-amber-50 border-b border-amber-200 shadow-lg">
          <div className="px-4 sm:px-6 py-3">
            <ul aria-label="Tüm seçili ürünler" className="flex flex-wrap gap-1.5">{full.shown.map(chip)}</ul>
            {chips.length > CHIP_LIMIT && (
              <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 text-[11px] font-semibold text-amber-800 hover:underline">
                {all ? "Gizle" : `Tümünü göster (+${full.more})`}
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
