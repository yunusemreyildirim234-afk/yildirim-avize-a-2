"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Tetikleyici içeriği; açık durumu verilir (ok ikonunu döndürmek için) */
  trigger: (open: boolean) => React.ReactNode;
  label: string;
  align?: "left" | "right";
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

// Masaüstünde hover, her cihazda tıklama ile açılan açılır menü
export default function HoverMenu({ trigger, label, align = "left", panelClassName = "", children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canHover = () => window.matchMedia("(hover: hover)").matches;
  const show = () => {
    clearTimeout(timer.current);
    if (canHover()) setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (canHover()) timer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1.5 hover:bg-zinc-100 transition-colors"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full pt-2 z-50 ${align === "right" ? "right-0" : "left-0"} ${panelClassName}`}
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl p-3">{children(() => setOpen(false))}</div>
        </div>
      )}
    </div>
  );
}
