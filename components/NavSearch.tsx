"use client";

import { PRICE_CONTACT_TEXT, hasPrice } from "@/lib/has-price";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/useFocusTrap";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import RecentSearches from "@/components/RecentSearches";
import { toast } from "sonner";
import { clearRecentSearches, getRecentSearches, removeRecentSearch, restoreRecentSearches, saveRecentSearch } from "@/lib/recent-searches";
import { track } from "@/lib/track";
import { MAX_SEARCH_LEN } from "@/lib/product-search";
import { CartStepper, FavoriteButton, type QuickProduct } from "@/components/ProductQuickActions";
import { smallImage } from "@/lib/img";
import { productPath } from "@/lib/product-url";

type Result = QuickProduct;

function Results({
  query,
  results,
  loading,
  searched,
  suggestion,
  corrected,
  onSuggest,
  onPick,
}: {
  query: string;
  results: Result[];
  loading: boolean;
  searched: boolean;
  suggestion: string | null;
  corrected: string | null;
  onSuggest: (term: string) => void;
  onPick: () => void;
}) {
  if (loading && results.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-ink-subtle flex items-center justify-center gap-2">
        <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> Aranıyor...
      </p>
    );
  }
  if (!searched) return null;
  if (results.length === 0) {
    return (
      <div className="p-5 text-center text-xs text-ink-muted space-y-2">
        <p>&ldquo;{query}&rdquo; ile eşleşen ürün bulunamadı.</p>
        {suggestion && (
          <p>
            Bunu mu demek istediniz:{" "}
            <button type="button" onClick={() => onSuggest(suggestion)} className="font-semibold text-bronze-ink underline underline-offset-2">
              {suggestion}
            </button>
            ?
          </p>
        )}
        <Link href="/kategori/tum" className="inline-block font-semibold text-bronze-ink underline underline-offset-2">Tüm koleksiyona göz atın →</Link>
      </div>
    );
  }
  return (
    <>
      {corrected && (
        <p role="status" className="px-3 py-2 text-xs text-ink-muted bg-surface border-b border-line">
          <strong className="text-ink">&ldquo;{corrected}&rdquo;</strong> için gösteriliyor
        </p>
      )}
    <ul role="listbox" aria-label="Arama sonuçları" className="divide-y divide-line max-h-[70vh] overflow-y-auto">
      {results.map((p) => (
        <li key={p.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-surface transition-colors">
          <Link href={productPath(p)} onClick={onPick} className="flex-1 min-w-0 flex items-center gap-3">
            <span className="w-12 h-12 rounded-lg bg-photo overflow-hidden shrink-0 border border-line flex items-center justify-center">
              {p.imageUrl && <img src={smallImage(p.imageUrl)} alt="" width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-serif font-bold text-ink truncate">{p.title}</span>
              <span className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-bronze-ink bg-surface px-1.5 py-0.5 rounded-full font-medium">{p.category}</span>
                {p.modelCode && <span className="text-[10px] font-mono text-ink-subtle">Model {p.modelCode}</span>}
              </span>
              <span className="block text-xs font-bold text-ink mt-1">{hasPrice(p.basePrice) ? `${p.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : PRICE_CONTACT_TEXT}</span>
            </span>
          </Link>
          <div className="w-28 shrink-0 space-y-1.5">
            <div className="flex justify-end">
              <FavoriteButton product={p} />
            </div>
            <CartStepper product={p} inlineToast />
          </div>
        </li>
      ))}
    </ul>
    </>
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
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [corrected, setCorrected] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const desktopRef = useRef<HTMLDivElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  // Arama terimini (en az 2 karakter) son aramalara ekler ve olay olarak kaydeder
  const remember = (term: string) => {
    if (term.trim().length < 2) return;
    setRecent(saveRecentSearch(term));
    track("SEARCH", term.trim());
  };

  const onChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setSuggestion(null);
      setCorrected(null);
      setSearched(false);
      setLoading(false);
    }
    setOpen(true);
  };

  const openPanel = () => {
    setRecent(getRecentSearches());
    setOpen(true);
  };

  const pickRecent = (term: string) => {
    onChange(term);
    remember(term);
    (window.innerWidth >= 768 ? desktopInput : mobileInput).current?.focus();
  };

  // Son aramaları değiştirir; 6 saniye içinde geri alınabilir
  const undoable = (change: () => string[], message: string) => {
    const before = recent;
    setRecent(change());
    toast(message, { duration: 6000, action: { label: "↩ Geri Al", onClick: () => setRecent(restoreRecentSearches(before)) } });
  };

  const recentList = (
    <RecentSearches
      items={recent}
      onPick={pickRecent}
      onRemove={(t) => undoable(() => removeRecentSearch(t), "Arama kaldırıldı")}
      onClear={() => undoable(clearRecentSearches, "Son aramalar temizlendi")}
    />
  );

  const reset = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSuggestion(null);
    setCorrected(null);
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
        setSuggestion(typeof data.suggestion === "string" ? data.suggestion : null);
        setCorrected(typeof data.corrected === "string" ? data.corrected : null);
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

  // Mobil katman: Tab döngüsü, Esc ve kapanınca odağın büyüteç düğmesine dönmesi (ilk odağı aşağıdaki mobileInput.focus() verir)
  const mobileLayerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open && typeof window !== "undefined" && window.innerWidth < 768, mobileLayerRef, { onEscape: () => setOpen(false), initialFocus: "none" });

  // Mobil katman açıkken sayfa kaydırmasını kilitle
  useEffect(() => {
    if (!open || window.innerWidth >= 768) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Enter / büyüteç: tüm sonuçların listelendiği arama sayfasına git (öneriye tıklamak ürüne gider)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    remember(q);
    router.push(`/arama?q=${encodeURIComponent(q.slice(0, MAX_SEARCH_LEN))}`);
    reset();
  };

  const showPanel = open && query.trim().length > 0;
  const showRecent = open && !query.trim() && recent.length > 0;
  const pickResult = () => {
    remember(query);
    reset();
  };

  const field = (ref: React.RefObject<HTMLInputElement | null>, className: string) => (
    <input
      ref={ref}
      type="search"
      aria-label="Ürün adı, model kodu veya stok kodu ile ara"
      placeholder="Ürün adı, model kodu (1-236), stok kodu..."
      value={query}
      onFocus={openPanel}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );

  return (
    <>
      {/* Masaüstü: genişleyen arama çubuğu */}
      <div
        ref={desktopRef}
        className="relative hidden md:block"
        onBlur={(e) => {
          // Klavyeyle (Tab) başka bir öğeye geçilince açılır paneller kapanır; relatedTarget yoksa (tıklama) dışarı tıklama işleyicisi karar verir
          const next = e.relatedTarget as Node | null;
          if (window.innerWidth >= 768 && next && !e.currentTarget.contains(next)) setOpen(false);
        }}
      >
        <form
          onSubmit={onSubmit}
          role="search"
          className={`relative transition-all duration-300 ease-out ${open || query ? "w-64 lg:w-80" : "w-44 lg:w-64 xl:w-80"}`}
        >
          <button type="submit" aria-label="Ara" className="absolute left-0 top-0 h-full w-9 flex items-center justify-center rounded-l-full text-ink-subtle hover:text-bronze-ink">
            <Search aria-hidden="true" className="w-4 h-4" />
          </button>
          {field(
            desktopInput,
            "w-full text-xs pl-9 pr-8 py-2 rounded-full bg-surface border border-line text-ink placeholder-ink-subtle focus:bg-raised focus:border-bronze-ink focus:outline-none focus:ring-2 focus:ring-bronze/20 [&::-webkit-search-cancel-button]:hidden"
          )}
          {query && (
            <button
              type="button"
              aria-label="Aramayı temizle"
              onClick={() => {
                reset();
                desktopInput.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
        {showPanel && (
          <div className="absolute right-0 top-full z-30 mt-2 w-[26rem] bg-raised rounded-2xl border border-line shadow-xl overflow-hidden">
            <Results query={query.trim()} results={results} loading={loading} searched={searched} suggestion={suggestion} corrected={corrected} onSuggest={onChange} onPick={pickResult} />
          </div>
        )}
        {showRecent && <div className="absolute right-0 top-full z-30 mt-2 w-[26rem] bg-raised rounded-2xl border border-line shadow-xl overflow-hidden">{recentList}</div>}
      </div>

      {/* Mobil: büyüteç ikonu */}
      <button
        type="button"
        aria-label="Ürün ara"
        onClick={() => {
          openPanel();
          setTimeout(() => mobileInput.current?.focus(), 50);
        }}
        className="md:hidden rounded-full p-2.5 hover:bg-surface transition-colors"
      >
        <Search aria-hidden="true" className="w-5 h-5 text-ink" />
      </button>

      {/* Mobil: tam genişlik arama katmanı */}
      {open && (
        <div ref={mobileLayerRef} role="dialog" aria-modal="true" aria-label="Ürün ara" className="md:hidden fixed inset-0 z-[60] bg-canvas flex flex-col">
          <form onSubmit={onSubmit} role="search" className="flex items-center gap-2 px-3 h-16 border-b border-line shrink-0">
            <div className="relative flex-1">
              <button type="submit" aria-label="Ara" className="absolute left-0 top-0 h-full w-10 flex items-center justify-center rounded-l-full text-ink-subtle hover:text-bronze-ink">
                <Search aria-hidden="true" className="w-4 h-4" />
              </button>
              {field(
                mobileInput,
                "w-full text-base sm:text-sm pl-9 pr-3 py-2.5 rounded-full bg-surface text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-bronze/30 [&::-webkit-search-cancel-button]:hidden"
              )}
            </div>
            <button type="button" aria-label="Aramayı kapat" onClick={reset} className="rounded-full p-2.5 hover:bg-surface">
              <X aria-hidden="true" className="w-5 h-5 text-ink-muted" />
            </button>
          </form>
          <div className="flex-1 overflow-y-auto">
            {query.trim() ? (
              <Results query={query.trim()} results={results} loading={loading} searched={searched} suggestion={suggestion} corrected={corrected} onSuggest={onChange} onPick={pickResult} />
            ) : recent.length > 0 ? (
              recentList
            ) : (
              <p className="p-6 text-center text-xs text-ink-subtle">Ürün adı, model kodu veya stok kodu yazın.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
