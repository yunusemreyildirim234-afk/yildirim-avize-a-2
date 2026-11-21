"use client";

import { useRef, useState } from "react";

export default function CopyTrackingCode({ code, className = "" }: { code: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("ok");
      setTimeout(() => setState("idle"), 2000);
    } catch {
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
        {state === "fail" ? "Seçili, Ctrl+C ile kopyalayın" : ""}
      </span>
    </span>
  );
}
