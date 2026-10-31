"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

interface Result {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  imageUrl?: string | null;
  modelCode?: string | null;
}

function Results({
  query,
  results,
  loading,
  searched,
  onPick,
}: {
  query: string;
  results: Result[];
  loading: boolean;
  searched: boolean;
  onPick: () => void;
}) {
  if (loading && results.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
        <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> Aranıyor...
      </p>
    );
  }
  if (!searched) return null;
  if (results.length === 0) {
    return <p className="p-4 text-center text-xs text-zinc-500">&ldquo;{query}&rdquo; ile eşleşen ürün bulunamadı.</p>;
  }
  return (
    <ul role="listbox" aria-label="Arama sonuçları" className="divide-y divide-zinc-100 max-h-[70vh] overflow-y-auto">
      {results.map((p) => (
        <li key={p.id}>
          <Link
            href={`/urun/${p.id}`}
            onClick={onPick}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50/60 transition-colors"
          >
            <span className="w-12 h-12 rounded-lg bg-zinc-900 overflow-hidden shrink-0 border border-zinc-200 flex items-center justify-center">
              {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-serif font-bold text-zinc-900 truncate">{p.title}</span>
              <span className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">{p.category}</span>
                {p.modelCode && <span className="text-[10px] font-mono text-zinc-500">Model {p.modelCode}</span>}
              </span>
            </span>
            <span className="text-xs font-bold text-zinc-800 shrink-0">{p.basePrice.toLocaleString("tr-TR")} ₺</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function NavSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  // Sayfa değişince kapat
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rota değişiminde arama durumunu sıfırlar
    reset();
  }, [pathname]);

  // Anlık arama (ürün adı, model kodu, stok kodu)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.products || []);
        setSearched(true);
      } catch {
        /* iptal veya ağ hatası */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Masaüstü: dışarı tıklayınca / ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (window.innerWidth >= 768 && desktopRef.current && !desktopRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Mobil katman açıkken sayfa kaydırmasını kilitle
  useEffect(() => {
    if (!open || window.innerWidth >= 768) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
    }
    setOpen(true);
  };

  // Enter: tek/ilk sonuca git
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) {
      router.push(`/urun/${results[0].id}`);
      reset();
    }
  };

  const showPanel = open && query.trim().length > 0;

  const field = (ref: React.RefObject<HTMLInputElement | null>, className: string) => (
    <input
      ref={ref}
      type="search"
      aria-label="Ürün adı, model kodu veya stok kodu ile ara"
      placeholder="Ürün adı, model kodu (1-236), stok kodu..."
      value={query}
      onFocus={() => setOpen(true)}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );

  return (
    <>
      {/* Masaüstü: genişleyen arama çubuğu */}
      <div ref={desktopRef} className="relative hidden md:block">
        <form
          onSubmit={onSubmit}
          role="search"
          className={`relative transition-all duration-300 ease-out ${open || query ? "w-72 lg:w-80" : "w-44"}`}
        >
          <Search aria-hidden="true" className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {field(
            desktopInput,
            "w-full text-xs pl-9 pr-8 py-2 rounded-full bg-zinc-100 border border-transparent text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 [&::-webkit-search-cancel-button]:hidden"
          )}
          {query && (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => {
                reset();
                desktopInput.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
        {showPanel && (
          <div className="absolute right-0 top-full mt-2 w-[26rem] bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden">
            <Results query={query.trim()} results={results} loading={loading} searched={searched} onPick={reset} />
          </div>
        )}
      </div>

      {/* Mobil: büyüteç ikonu */}
      <button
        type="button"
        aria-label="Ürün ara"
        onClick={() => {
          setOpen(true);
          setTimeout(() => mobileInput.current?.focus(), 50);
        }}
        className="md:hidden rounded-full p-2.5 hover:bg-zinc-100 transition-colors"
      >
        <Search aria-hidden="true" className="w-5 h-5 text-zinc-800" />
      </button>

      {/* Mobil: tam genişlik arama katmanı */}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Ürün ara" className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col">
          <form onSubmit={onSubmit} role="search" className="flex items-center gap-2 px-3 h-16 border-b border-zinc-100 shrink-0">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {field(
                mobileInput,
                "w-full text-sm pl-9 pr-3 py-2.5 rounded-full bg-zinc-100 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 [&::-webkit-search-cancel-button]:hidden"
              )}
            </div>
            <button type="button" aria-label="Aramayı kapat" onClick={reset} className="rounded-full p-2.5 hover:bg-zinc-100">
              <X aria-hidden="true" className="w-5 h-5 text-zinc-700" />
            </button>
          </form>
          <div className="flex-1 overflow-y-auto">
            {query.trim() ? (
              <Results query={query.trim()} results={results} loading={loading} searched={searched} onPick={reset} />
            ) : (
              <p className="p-6 text-center text-xs text-zinc-400">Ürün adı, model kodu veya stok kodu yazın.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
