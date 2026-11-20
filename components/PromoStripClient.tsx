"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { AVANTAJ_ACMA_OLAYI, AVANTAJ_DEGISTI_OLAYI, AVANTAJ_KAYIT_ANAHTARI, avantajGorunsunMu, kaydiCoz, type AvantajKaydi } from "@/lib/promo-dismiss";

/** Avantaj şeridini gizlenebilir yapar. Karar mantığı lib/promo-dismiss.ts içinde (24 saat + içerik sürümü). Depolama yoksa/hata verirse şerit açık kalır. */
export function DismissibleStrip({ surum, children }: { surum: string; children: React.ReactNode }) {
  // null: henüz okunmadı. İlk render'da içerik sunucuyla aynı (yer kaplar, görünmez); okununca ya görünür ya kalkar (yanıp sönme yok).
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    const oku = () => {
      let kayit = null;
      try {
        kayit = kaydiCoz(localStorage.getItem(AVANTAJ_KAYIT_ANAHTARI));
      } catch {
        /* depolama kapalı: şerit açık kalır */
      }
      setVisible(avantajGorunsunMu({ kayit, guncelSurum: surum, simdi: Date.now() }));
    };
    oku();
    window.addEventListener(AVANTAJ_ACMA_OLAYI, oku);
    return () => window.removeEventListener(AVANTAJ_ACMA_OLAYI, oku);
  }, [surum]);

  const hide = () => {
    setVisible(false);
    try {
      const kayit: AvantajKaydi = { surum, gizlenmeZamani: Date.now() };
      localStorage.setItem(AVANTAJ_KAYIT_ANAHTARI, JSON.stringify(kayit));
    } catch {
      /* yoksay */
    }
    window.dispatchEvent(new Event(AVANTAJ_DEGISTI_OLAYI));
  };

  if (visible === false) return null;
  return (
    <section id="avantajlar" aria-label="Avantajlar" className={`relative bg-canvas border-y border-line scroll-mt-20 ${visible === null ? "invisible" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-2">
        <h2 className="sr-only">Avantajlar</h2>
        {children}
        <button
          type="button"
          onClick={hide}
          aria-label="Gizle"
          title="Gizle"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 -my-1 -mr-3 rounded-full text-ink-subtle hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

/** Altbilgideki "Avantajlar" bağlantısı: yalnızca kart gizliyken (geçerli kayıt varken) görünür; tıklanınca kaydı siler ve kartı açar. */
export function AvantajlarAcLink({ className }: { className: string }) {
  const router = useRouter();
  const [gizli, setGizli] = useState(false);

  useEffect(() => {
    const oku = () => {
      let kayit = null;
      try {
        kayit = kaydiCoz(localStorage.getItem(AVANTAJ_KAYIT_ANAHTARI));
      } catch {
        /* yoksay */
      }
      // Sürüm burada bilinmez; süresi dolmamış kayıt = gizli sayılır (sürüm farklıysa kart zaten açıktır, bağlantı yalnızca ona kaydırır).
      setGizli(!!kayit && avantajGorunsunMu({ kayit: { ...kayit, surum: "" }, guncelSurum: "", simdi: Date.now() }) === false);
    };
    oku();
    window.addEventListener(AVANTAJ_DEGISTI_OLAYI, oku);
    window.addEventListener("storage", oku);
    return () => {
      window.removeEventListener(AVANTAJ_DEGISTI_OLAYI, oku);
      window.removeEventListener("storage", oku);
    };
  }, []);

  if (!gizli) return null;
  const ac = () => {
    try {
      localStorage.removeItem(AVANTAJ_KAYIT_ANAHTARI);
    } catch {
      /* yoksay */
    }
    setGizli(false);
    window.dispatchEvent(new Event(AVANTAJ_DEGISTI_OLAYI));
    window.dispatchEvent(new Event(AVANTAJ_ACMA_OLAYI));
    if (window.location.pathname === "/") {
      requestAnimationFrame(() => document.getElementById("avantajlar")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      router.push("/#avantajlar");
    }
  };
  return (
    <button type="button" onClick={ac} className={className}>
      Avantajlar
    </button>
  );
}

async function copyText(text: string, el: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* yedek yollar aşağıda */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* yoksay */
  }
  // Son yedek: görünen kodu seç, kullanıcı kendisi kopyalasın
  const sel = window.getSelection();
  if (el && sel) {
    const r = document.createRange();
    r.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  return false;
}

/** Kupon kodu + "Kopyala" düğmesi. Sonuç aria-live ile duyurulur. */
export function CopyCode({ code, buttonClass, codeClass }: { code: string; buttonClass: string; codeClass: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const codeRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onCopy = async () => {
    const ok = await copyText(code, codeRef.current);
    setState(ok ? "copied" : "selected");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 3000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code ref={codeRef} className={`font-mono font-bold text-sm tracking-wider rounded-md px-2 py-1 select-all ${codeClass}`}>
        {code}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink ${buttonClass}`}
      >
        {state === "copied" ? <Check aria-hidden="true" className="w-4 h-4" /> : <Copy aria-hidden="true" className="w-4 h-4" />}
        {state === "copied" ? "Kopyalandı ✓" : "Kopyala"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Kupon kodu kopyalandı" : state === "selected" ? "Kod seçildi, kopyalamak için Ctrl+C kullanın" : ""}
      </span>
      {state === "selected" && <span aria-hidden="true" className="text-[11px]">Kod seçildi, Ctrl+C ile kopyalayın</span>}
    </div>
  );
}

/** Avantaj öğeleri için yatay kayan liste (scroll-snap, görünür çubuk yok). Yalnızca taşma varken ve o yönde yer kalmışken ‹ › düğmeleri ve kenar solması görünür; tüm öğeler sığıyorsa hiçbiri çıkmaz. Navbar'daki kategori satırıyla aynı mantık. */
export function ScrollList({ children }: { children: React.ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setEdge({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const scrollBySide = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow = "absolute top-0 bottom-0 z-10 flex w-10 items-center text-ink-muted hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-bronze-ink";
  return (
    <div className="relative flex-1 min-w-0">
      <ul
        ref={listRef}
        onFocus={(e) => e.target.scrollIntoView({ inline: "nearest", block: "nearest" })}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      {edge.left && (
        <button type="button" aria-label="Önceki avantajlar" onClick={() => scrollBySide(-1)} className={`${arrow} left-0 justify-start bg-gradient-to-r from-canvas from-60% to-transparent`}>
          <ChevronLeft aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label="Sonraki avantajlar" onClick={() => scrollBySide(1)} className={`${arrow} right-0 justify-end bg-gradient-to-l from-canvas from-60% to-transparent`}>
          <ChevronRight aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
