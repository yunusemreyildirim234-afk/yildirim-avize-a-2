"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  /** Bekleyen iş sayısı (0 ise gösterilmez) */
  badge?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const chip = "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:border-amber-600 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600";

/**
 * Yapışkan "bölüme git" çubuğu. Mağaza menüsünün (sticky header) altına oturur; bölüm başlıkları çubuğun altında kalmasın diye
 * kaydırma ofseti --admin-offset olarak yazılır. Gidilen bölüm kapalıysa açılır (bölümler /admin#<id> bağlantısını dinler).
 * Günlük işler her zaman şeritte (tek satır; dar ekranda yatay kaydırılır), diğer bölümler sağdaki "Tümü" panelinde başlıklar altında.
 * Panel şeridin altına açılır ve akışın dışındadır: şerit yüksekliğini ve --admin-offset değerini değiştirmez.
 */
export default function AdminSectionNav({ daily, groups }: { daily: NavItem[]; groups: NavGroup[] }) {
  const bar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState(64);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("body > header, header.sticky");
    const apply = () => {
      const h = header?.getBoundingClientRect().height ?? 0;
      setTop(Math.round(h));
      const own = bar.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--admin-offset", `${Math.round(h + own + 12)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (header) ro.observe(header);
    if (bar.current) ro.observe(bar.current);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--admin-offset");
    };
  }, []);

  // Panel açıkken: Esc kapatır (odak düğmeye döner), şeridin dışına basmak kapatır
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setOpen(false);
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    // Açılmayan (her zaman açık) bölümler için doğrudan kaydır
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const link = (it: NavItem, className: string) => (
    <a href={`#${it.id}`} onClick={(e) => go(e, it.id)} className={className}>
      {it.label}
      {it.badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[11px] font-bold leading-5 text-white">
          {it.badge}
          <span className="sr-only"> bekleyen</span>
        </span>
      ) : null}
    </a>
  );

  return (
    <nav ref={bar} aria-label="Yönetim bölümleri" style={{ top }} className="sticky z-40 -mx-4 sm:-mx-6 lg:mx-0 flex items-stretch bg-neutral-100 border-b border-neutral-200 lg:rounded-xl lg:border">
      <ul data-testid="gunluk-isler" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pl-4 sm:pl-6 lg:pl-3 pr-2 py-2 [scrollbar-width:thin]">
        {daily.map((it) => (
          <li key={it.id} className="shrink-0">
            {link(it, chip)}
          </li>
        ))}
      </ul>
      <div className="flex shrink-0 items-center border-l border-neutral-300 pl-2 pr-4 sm:pr-6 lg:pr-3 py-2">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="admin-nav-panel"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
        >
          Tümü <ChevronDown aria-hidden="true" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div id="admin-nav-panel" hidden={!open} className="absolute left-0 right-0 top-full max-h-[70vh] overflow-y-auto border-b border-neutral-300 bg-white px-4 sm:px-6 lg:px-4 py-4 shadow-lg lg:mt-1 lg:rounded-xl lg:border">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-600">{g.title}</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                {g.items.map((it) => (
                  <li key={it.id}>{link(it, `${chip} w-full whitespace-normal`)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </nav>
  );
}
