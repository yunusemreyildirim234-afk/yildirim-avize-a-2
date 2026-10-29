"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CouponItem {
  id: string;
  code: string;
  discountPercent: number;
  personal: boolean;
  remaining: number | null; // null: sınırsız
  product: { title: string; modelCode: string | null } | null;
}

// Hesabım → Kuponlarım
export default function MyCoupons() {
  const [coupons, setCoupons] = useState<CouponItem[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my-coupons", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCoupons(data.coupons ?? []))
      .catch(() => setCoupons([]));
  }, []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Kuponu kopyalayın:", code);
    }
  };

  return (
    <div id="kuponlar" className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6 scroll-mt-24">
      <h2 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">Kuponlarım</h2>

      {coupons === null ? (
        <p className="text-center py-6 text-neutral-400 text-xs">Yükleniyor...</p>
      ) : coupons.length === 0 ? (
        <p className="text-center py-6 text-neutral-400 text-xs">Şu anda kullanabileceğiniz kupon bulunmuyor.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((c) => (
            <li key={c.id} className="border border-dashed border-amber-300 bg-amber-50/50 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl font-serif font-bold text-neutral-900">%{c.discountPercent}</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    c.personal ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {c.personal ? "Size Özel" : "Herkese Açık"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-3 py-2">
                <span className="font-mono font-bold text-neutral-900 text-[13px] break-all">{c.code}</span>
                <button
                  type="button"
                  onClick={() => copy(c.code)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 transition-colors"
                >
                  {copied === c.code ? <Check aria-hidden="true" className="w-3.5 h-3.5" /> : <Copy aria-hidden="true" className="w-3.5 h-3.5" />}
                  {copied === c.code ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-neutral-200 text-neutral-700 font-semibold px-2.5 py-1 rounded-full">
                  {c.product ? `${c.product.modelCode ? `Model ${c.product.modelCode} • ` : ""}${c.product.title}` : "Tüm ürünler"}
                </span>
                <span className="bg-white border border-neutral-200 text-neutral-700 font-semibold px-2.5 py-1 rounded-full">
                  {c.remaining === null ? "Sınırsız kullanım" : `Kalan hak: ${c.remaining}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
