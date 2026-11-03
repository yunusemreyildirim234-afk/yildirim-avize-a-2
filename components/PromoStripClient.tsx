"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";

const STORAGE_KEY = "ya-promo-closed";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Avantaj şeridini kapatılabilir yapar; tercih 7 gün saklanır (kart kümesi değişirse şerit yeniden görünür). Depolama yoksa/hata verirse şerit açık kalır. */
export function DismissibleStrip({ sig, children }: { sig: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { sig?: string; until?: number };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- istemci depolaması ilk render sonrası okunur (hydration uyumu)
      if (saved.sig === sig && typeof saved.until === "number" && saved.until > Date.now()) setHidden(true);
    } catch {
      /* depolama kapalı/bozuk: şerit açık kalır */
    }
  }, [sig]);

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sig, until: Date.now() + WEEK_MS }));
    } catch {
      /* yoksay */
    }
  };

  if (hidden) return null;
  return (
    <section aria-label="Avantajlar" className="relative bg-zinc-50 border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs uppercase tracking-widest font-semibold text-zinc-700">Avantajlar</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Avantajlar bölümünü kapat"
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
