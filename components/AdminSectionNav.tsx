"use client";

import { useEffect, useRef, useState } from "react";

export interface NavItem {
  id: string;
  label: string;
}

/**
 * Yapışkan "bölüme git" çubuğu. Mağaza menüsünün (sticky header) altına oturur; bölüm başlıkları çubuğun altında kalmasın diye
 * kaydırma ofseti --admin-offset olarak yazılır. Gidilen bölüm kapalıysa açılır (bölümler /admin#<id> bağlantısını dinler).
 * Mobilde yatay kaydırılabilir şerit (sayfa taşmaz).
 */
export default function AdminSectionNav({ items }: { items: NavItem[] }) {
  const bar = useRef<HTMLElement>(null);
  const [top, setTop] = useState(64);

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

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    // Açılmayan (her zaman açık) bölümler için doğrudan kaydır
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav ref={bar} aria-label="Yönetim bölümleri" style={{ top }} className="sticky z-40 -mx-4 sm:-mx-6 lg:mx-0 bg-neutral-100/95 backdrop-blur-sm border-b border-neutral-200 lg:rounded-xl lg:border">
      <ul className="flex gap-2 overflow-x-auto px-4 sm:px-6 lg:px-3 py-2 [scrollbar-width:thin]">
        {items.map((it) => (
          <li key={it.id} className="shrink-0">
            <a
              href={`#${it.id}`}
              onClick={(e) => go(e, it.id)}
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:border-amber-600 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
