"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCart } from "@/context/CartContext";
import { loadCartMore } from "@/app/cart-more";
import ProductStrip from "@/components/ProductStrip";

type Item = { id: string; node: ReactNode };
type Start = { items: Item[]; cursor: number; hasMore: boolean };

/**
 * Sepet sayfası "Sepetinize uygun diğer ürünler" şeridi. Veri sayfa açılınca değil, bölüm ekrana yaklaşınca BİR KEZ yüklenir.
 * Sepet o andaki ürün kimlikleriyle "dondurulur": sepet sonradan değişse (karttaki CartStepper dahil) şerit yeniden yüklenmez, yeniden sıralanmaz.
 * Sepet boşsa ya da sepetin kategorisi bulunamazsa hiçbir şey çizilmez.
 */
export default function CartMoreStrip() {
  const { cart } = useCart();
  const rootRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const cartIds = useRef<string[]>([]);
  const [frozen, setFrozen] = useState<string[] | null>(null); // yükleme başladığında sepetteki ürün kimlikleri
  const [start, setStart] = useState<Start | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready" | "empty">("idle");
  const ids = useMemo(() => [...new Set(cart.map((i) => i.productId))].slice(0, 50), [cart]);
  const hasItems = ids.length > 0;
  useEffect(() => {
    cartIds.current = ids; // yükleme anında güncel sepet okunsun (render sırasında ref yazılmaz)
  }, [ids]);

  const run = useCallback(async () => {
    const ids = cartIds.current;
    if (ids.length === 0) return;
    setFrozen(ids);
    setState("loading");
    try {
      const res = await loadCartMore(ids, 0);
      if (!res.ok) throw new Error("fail");
      if (res.items.length === 0 && !res.hasMore) {
        setState("empty");
        return;
      }
      setStart({ items: res.items, cursor: res.cursor, hasMore: res.hasMore });
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  // Bölüm ekrana yaklaşınca bir kez başlar (rootMargin: yaklaşırken önceden)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !hasItems || started.current) return;
    if (typeof IntersectionObserver === "undefined") {
      started.current = true;
      void run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (started.current || !entries.some((e) => e.isIntersecting)) return;
        started.current = true;
        io.disconnect();
        void run();
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasItems, run]);

  // Sonraki sayfalar da dondurulmuş sepet kimlikleriyle istenir (liste kararlı kalır)
  const load = useCallback((cursor: number) => loadCartMore(frozen ?? [], cursor), [frozen]);

  if (!hasItems && state === "idle") return null;
  if (state === "empty") return null;

  return (
    <section ref={rootRef} aria-labelledby="sepet-serit" data-testid="sepet-serit" className="max-w-6xl mx-auto mt-10">
      <h2 id="sepet-serit" className="text-lg font-serif font-bold text-neutral-900 mb-4">
        Sepetinize uygun diğer ürünler
      </h2>
      {state === "ready" && start && frozen && <ProductStrip initial={start.items} initialCursor={start.cursor} initialHasMore={start.hasMore} load={load} label="Sepetinize uygun diğer ürünler" />}
      {(state === "idle" || state === "loading") && (
        <div aria-hidden="true" className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-[70%] sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] rounded-2xl border border-neutral-200 bg-white p-3 animate-pulse">
              <div className="aspect-square rounded-xl bg-neutral-200" />
              <div className="mt-3 h-3 w-3/4 rounded bg-neutral-200" />
              <div className="mt-2 h-3 w-1/3 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      )}
      {state === "loading" && <p role="status" className="sr-only">Ürünler yükleniyor</p>}
      {state === "error" && (
        <p role="alert" className="text-center text-xs text-red-700">
          Ürünler şu an getirilemedi.{" "}
          <button type="button" onClick={() => void run()} className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-600">
            Tekrar dene
          </button>
        </p>
      )}
    </section>
  );
}
