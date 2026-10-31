"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Badge {
  label: string;
  tone: "amber" | "red" | "neutral";
}

const TONES = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

/** Varsayılan kapalı, yumuşak animasyonla açılan yönetim paneli bölümü. */
export default function AdminSection({
  id,
  title,
  description,
  badges = [],
  children,
}: {
  id: string;
  title: string;
  description?: string;
  badges?: Badge[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Bildirimden gelen /admin#<id> bağlantısı bölümü açar ve ekrana getirir
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  return (
    <section id={id} className="scroll-mt-4 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900">{title}</h2>
          {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
        </div>
        <span className="flex items-center gap-2 shrink-0">
          {badges.map((b) => (
            <span key={b.label} className={`text-xs font-semibold border px-3 py-1.5 rounded-lg ${TONES[b.tone]}`}>
              {b.label}
            </span>
          ))}
          <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div id={`${id}-panel`} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className="border-t border-neutral-100">{children}</div>
        </div>
      </div>
    </section>
  );
}
