"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";

export default function CopyTrackingCode({ code, className = "" }: { code: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const [hint, setHint] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (await copyText(code)) {
      setState("ok");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2000);
    } else {
      // Kopyalanamadı: kod seçilir; yönerge cihaza göre (dokunmatikte Ctrl+C yok)
      const fine = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
      setHint(fine ? "Ctrl+C ile kopyalayın" : "Kod seçildi, uzun basıp Kopyala'ya dokunun");
      const el = ref.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setState("fail");
    }
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span ref={ref} className="select-all break-all rounded-lg border border-line bg-raised px-3 py-2 font-mono text-sm font-bold text-ink">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="min-h-11 rounded-lg border border-line bg-raised px-4 text-sm font-semibold text-ink hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {state === "ok" ? "Kopyalandı ✓" : "Kopyala"}
      </button>
      <span aria-live="polite" className="text-xs text-ink-muted">
        {state === "ok" ? "Kopyalandı" : state === "fail" ? hint : ""}
      </span>
    </span>
  );
}
