"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

const COUPON_CODE = "YILDIRIM5";

export default function AnnouncementBars() {
  const [closed, setClosed] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);

  const close = (i: number) => setClosed((prev) => ({ ...prev, [i]: true }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COUPON_CODE);
    } catch {
      window.prompt("Kupon kodunu kopyalayın:", COUPON_CODE);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bars = [
    {
      className: "bg-amber-100 text-amber-950 border-amber-200",
      content: (
        <>
          <strong>Sınırlı Süreli Teklif:</strong> Peşin ödemelere %10&apos;a varan indirimi kaçırma! Size özel %5 indirim kodu:{" "}
          <span className="inline-flex items-center gap-1.5 align-middle">
            <strong className="font-mono bg-white/70 border border-amber-300 rounded px-1.5 py-0.5">{COUPON_CODE}</strong>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md bg-amber-900 hover:bg-amber-800 text-white text-[11px] font-semibold px-2 py-1 transition-colors"
            >
              {copied ? <Check aria-hidden="true" className="w-3 h-3" /> : <Copy aria-hidden="true" className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </span>
        </>
      ),
    },
    {
      className: "bg-emerald-100 text-emerald-950 border-emerald-200",
      content: <strong>350 TL ve Üzeri Siparişlerde Kargo Ücretsiz!</strong>,
    },
    {
      className: "bg-zinc-200 text-zinc-900 border-zinc-300",
      content: <strong>Şişhane Merkezimizden (Mağazadan) Teslim Seçeneğine Özel Anında %3 İndirim!</strong>,
    },
  ];

  return (
    <div>
      {bars.map((bar, i) =>
        closed[i] ? null : (
          <div key={i} className={`border-b ${bar.className}`}>
            <div className="max-w-7xl mx-auto pl-4 pr-2 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-3 text-xs sm:text-[13px] leading-relaxed text-center">
              <p className="flex-1">{bar.content}</p>
              <button
                type="button"
                onClick={() => close(i)}
                aria-label="Duyuruyu kapat"
                className="shrink-0 rounded-full p-1.5 hover:bg-black/10 transition-colors"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
