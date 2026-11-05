"use client";

import { useId, useState, type ReactNode } from "react";
import { loadMoreProducts } from "@/app/home-more";

/**
 * Ana sayfa bölümü "Daha fazla göster": kalan ürünler sayfaya gömülü değildir; düğmeye basılınca 24'erli getirilir.
 * JS kapalıyken <noscript> içindeki "Tümünü gör" bağlantısı kategori sayfasına götürür.
 */
export default function MoreProducts({ section, total, cols, dark = false, fallbackHref }: { section: string; total: number; cols: string; dark?: boolean; fallbackHref: string }) {
  const listId = useId();
  const [items, setItems] = useState<{ id: string; node: ReactNode }[]>([]);
  const [offset, setOffset] = useState(0); // sunucuda ilerlenen konum (tekrar elemesi konumu kaydırmaz)
  const [remaining, setRemaining] = useState(total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (total <= 0) return null;

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await loadMoreProducts(section, offset);
      if (!res.ok) throw new Error("fail");
      const seen = new Set(items.map((i) => i.id));
      const fresh = res.items.filter((i) => !seen.has(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setOffset(offset + res.items.length);
      setRemaining(Math.max(0, res.total - (offset + res.items.length)));
    } catch {
      setError("Ürünler şu an getirilemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const btn = dark
    ? "text-white border border-white/40 hover:bg-white hover:text-zinc-900"
    : "text-zinc-800 border border-zinc-300 hover:border-amber-600 hover:text-amber-800";

  return (
    <div className="mt-6 sm:mt-8">
      <div id={listId} className={`grid ${cols} gap-4 sm:gap-6`}>
        {items.map((i) => i.node)}
      </div>
      {remaining > 0 && (
        <div className="mt-6 text-center sm:mt-8">
          <button
            type="button"
            onClick={load}
            aria-controls={listId}
            aria-expanded={items.length > 0}
            aria-busy={loading}
            disabled={loading}
            className={`mx-auto w-fit rounded-full px-6 py-3 text-xs font-semibold transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-amber-600 ${btn}`}
          >
            {loading ? "Yükleniyor…" : `Daha fazla göster (${remaining})`}
          </button>
          <noscript>
            <a href={fallbackHref} className={`inline-block rounded-full px-6 py-3 text-xs font-semibold ${btn}`}>
              Tümünü gör
            </a>
          </noscript>
        </div>
      )}
      <p role="status" aria-live="polite" className={`mt-3 text-center text-xs ${dark ? "text-red-300" : "text-red-700"}`}>
        {error}
      </p>
    </div>
  );
}
