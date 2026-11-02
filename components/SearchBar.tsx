"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CartStepper, FavoriteButton, type QuickProduct } from "@/components/ProductQuickActions";

type Product = QuickProduct;

export default function SearchBar({ variant = "nav" }: { variant?: "nav" | "hero" }) {
  const hero = variant === "hero";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Müşteri yazdıkça arama yap
  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- istemci depolamasını ilk render sonrası okumak gerekir (hydration)
      setResults([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.products || []);
        setIsOpen(true);
        setLoading(false);
      } catch (err) {
        // Yeni yazımla iptal edilen istek yoksayılır
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          setLoading(false);
        }
      }
    }, 250); // 250ms gecikme ile veritabanını yormayan akıllı sorgu

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Arama çubuğunun dışına tıklandığında menüyü kapat
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className={`relative w-full ${hero ? "" : "max-w-xs sm:max-w-sm"}`}>
      <div className="relative">
        <input
          type="text"
          aria-label="Avize ara"
          placeholder={hero ? "Avize modeli, kristal veya koleksiyon ara..." : "Avize modeli, kristal, tarz ara..."}
          value={query}
          onFocus={() => query.trim() && setIsOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          className={`w-full text-neutral-800 placeholder-neutral-400 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 border transition-all ${
            hero
              ? "bg-white text-base pl-12 pr-12 py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border-zinc-200 focus:border-amber-400"
              : "bg-neutral-100 text-xs pl-9 pr-8 py-2 focus:bg-white border-transparent focus:border-amber-400"
          }`}
        />
        {/* Arama İkonu */}
        <span className={`absolute text-neutral-400 ${hero ? "left-5 top-4 text-base" : "left-3 top-2.5 text-xs"}`}>
          🔍
        </span>

        {/* Temizle Butonu */}
        {query && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className={`absolute text-neutral-400 hover:text-neutral-600 ${hero ? "right-5 top-4 text-sm" : "right-3 top-2 text-xs"}`}
          >
            ✕
          </button>
        )}
      </div>

      {/* Açılır Canlı Sonuç Kutusu */}
      {isOpen && (
        <div className={`absolute ${hero ? "top-16 text-left" : "top-11"} left-0 right-0 bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150`}>
          {loading ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              Aranıyor...
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
              <div className="p-2.5 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Eşleşen Ürünler ({results.length})
              </div>
              {results.map((product) => (
                <div key={product.id} className="p-3 flex items-start gap-2 hover:bg-amber-50/50 transition-colors">
                  <Link href={`/urun/${product.id}`} onClick={() => setIsOpen(false)} className="flex-1 min-w-0 flex items-start gap-2.5">
                    <span className="w-12 h-12 rounded-lg bg-neutral-900 overflow-hidden shrink-0 border border-neutral-200">
                      {product.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                    <h4 className="text-xs font-serif font-bold text-neutral-900">
                      {product.title}
                    </h4>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium inline-block mt-0.5">
                      {product.category}
                    </span>
                    {product.modelCode && <span className="ml-1.5 text-[10px] font-mono text-neutral-500">Model {product.modelCode}</span>}
                    <span className="block text-xs font-bold text-neutral-800 mt-1">
                      {product.basePrice.toLocaleString("tr-TR")} ₺
                    </span>
                    </span>
                  </Link>
                  <div className="w-28 shrink-0 space-y-1.5">
                    <div className="flex justify-end">
                      <FavoriteButton product={product} />
                    </div>
                    <CartStepper product={product} inlineToast />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-neutral-500">
              &ldquo;{query}&rdquo; ile eşleşen bir ürün bulunamadı.
            </div>
          )}
        </div>
      )}
    </div>
  );
}