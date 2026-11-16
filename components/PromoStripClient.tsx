"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
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
    <section id="avantajlar" aria-label="Avantajlar" className={`relative bg-zinc-50 border-b border-zinc-200 scroll-mt-20 ${visible === null ? "invisible" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs uppercase tracking-widest font-semibold text-zinc-700">Avantajlar</h2>
          <button
            type="button"
            onClick={hide}
            aria-label="Gizle"
            title="Gizle"
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 -my-2 -mr-2 rounded-full text-zinc-600 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
        {children}
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
      <code ref={codeRef} className={`font-mono font-bold text-lg sm:text-xl tracking-wider rounded-lg px-3 py-1.5 select-all ${codeClass}`}>
        {code}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${buttonClass}`}
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
