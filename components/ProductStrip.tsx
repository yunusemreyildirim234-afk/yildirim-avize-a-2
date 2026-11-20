"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { loadSimilar } from "@/app/similar-more";
import { mergeUnique, nearEnd } from "@/lib/similar-strip";

type Item = { id: string; node: ReactNode };
/** Sonraki sayfayı getiren işlev (sunucu eylemi sonucu): `cursor` önceki yanıtın cursor değeridir. */
export type StripLoader = (cursor: number) => Promise<{ ok: true; items: Item[]; cursor: number; hasMore: boolean } | { ok: false; limited?: boolean }>;

/**
 * Yatay kaydırmalı ürün şeridi ("Benzer Avize Modelleri"). İlk ürünler sunucuda hazır gelir; sona yaklaşılınca (kaydırma ya da ok) sonraki 8 ürün getirilir.
 * Dokunmatikte parmakla kaydırma (scroll-snap), masaüstünde sağ/sol ok düğmeleri. Aynı anda tek istek; liste bitince sağ ok kaybolur, kaydırılmışsa sol ok görünür.
 * Kartlar sunucuda üretilir (ProductCard). Sonraki sayfa `load` ile gelir; verilmezse ürün sayfası eylemi (kategori + kendi ürün kimliği) kullanılır.
 */
export default function ProductStrip({
  initial,
  initialCursor,
  initialHasMore,
  category,
  excludeId,
  load: loadProp,
  label,
}: {
  initial: Item[];
  initialCursor: number;
  initialHasMore: boolean;
  /** Ürün sayfası kullanımı: `load` yoksa gerekir */
  category?: string;
  excludeId?: string;
  /** Verilirse sonraki sayfayı bu işlev getirir (örn. sepet şeridi); verilmezse loadSimilar(category, excludeId, cursor) */
  load?: StripLoader;
  /** Şerit bölgesinin ekran okuyucu adı */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const busy = useRef(false); // aynı anda tek istek
  const [items, setItems] = useState<Item[]>(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const load = useCallback(async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await (loadProp ?? ((c: number) => loadSimilar(category ?? "", excludeId ?? "", c)))(cursor);
      if (!res.ok) throw new Error(res.limited ? "limited" : "fail");
      setItems((prev) => mergeUnique(prev, res.items));
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } catch (e) {
      setError((e as Error).message === "limited" ? "Çok fazla istek yapıldı, lütfen biraz sonra tekrar deneyin." : "Ürünler şu an getirilemedi.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [loadProp, category, excludeId, cursor, hasMore]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    if (hasMore && !error && nearEnd(el.scrollLeft, el.clientWidth, el.scrollWidth)) void load();
  }, [hasMore, error, load]);

  // İlk çizimde ve her yeni ürün gelince: oklar güncellenir; şerit görünümü doldurmuyorsa (geniş ekran) bir sonraki sayfa istenir
  useEffect(() => {
    sync();
  }, [items, sync]);

  const scroll = (d: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: d * el.clientWidth * 0.75, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow =
    "hidden md:flex absolute top-1/3 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-raised/95 border border-line-strong text-ink shadow-sm hover:border-bronze-ink hover:text-bronze-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze-ink";

  return (
    <div className="relative" role="region" aria-label={label}>
      <div
        ref={ref}
        role="list"
        onScroll={sync}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((i) => (
          <div key={i.id} role="listitem" className="flex flex-col shrink-0 snap-start w-[70%] sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] [&>div]:flex-1">
            {i.node}
          </div>
        ))}
      </div>
      {canLeft && (
        <button type="button" onClick={() => scroll(-1)} aria-label="Önceki ürünler" className={`${arrow} left-2`}>
          <ChevronLeft aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
      {(canRight || hasMore) && (
        <button type="button" onClick={() => scroll(1)} aria-label="Sonraki ürünler" className={`${arrow} right-2`}>
          <ChevronRight aria-hidden="true" className="w-5 h-5" />
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-center text-xs text-ink-muted min-h-4">
        {loading ? "Yükleniyor…" : ""}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-center text-xs text-red-700">
          {error}{" "}
          <button type="button" onClick={() => { setError(""); void load(); }} className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-bronze-ink">
            Tekrar dene
          </button>
        </p>
      )}
    </div>
  );
}
