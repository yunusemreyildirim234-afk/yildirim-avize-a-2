"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { toastHref } from "@/lib/toast-link";
import { useCart } from "@/context/CartContext";
import { defaultSuggestionVariation, suggestionPrice, visibleSuggestions, type Suggestion } from "@/lib/complements";
import { displayTitle } from "@/lib/title-display";
import { productPath } from "@/lib/product-url";
import { smallImage } from "@/lib/img";

const tl = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Bununla birlikte alın" kartları (ürün sayfası ve sepet ortak). Liste boşsa hiçbir şey çizilmez. */
export default function ComplementSuggestions({ suggestions, heading = "Bununla birlikte alın", className = "mt-10" }: { suggestions: Suggestion[]; heading?: string; className?: string }) {
  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby="birlikte-alin" data-testid="birlikte-alin" className={className}>
      <h2 id="birlikte-alin" className="text-lg font-serif font-bold text-neutral-900 mb-4">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {suggestions.map((s) => (
          <li key={s.productId}>
            <SuggestionCard s={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ürün sayfası: sunucudan gelen sıralı öneriler; sepetteki ürünler gizlenir ve sayıya girmez, kart sayısı ayardan. Liste boşsa hiçbir şey çizilmez. */
export function ProductPageComplements({ suggestions, count }: { suggestions: Suggestion[]; count: number | null }) {
  const { cart } = useCart();
  if (suggestions.length === 0) return null;
  return <ComplementSuggestions suggestions={visibleSuggestions(suggestions, new Set(cart.map((i) => i.productId)), count)} />;
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const { addToCart } = useCart();
  const single = s.variations.length === 1;
  const [picking, setPicking] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = s.variations.find((v) => v.id === chosenId) ?? defaultSuggestionVariation(s);
  const price = suggestionPrice(s, chosen?.extraPrice ?? 0);
  const href = productPath({ id: s.productId, title: s.title });
  const shown = displayTitle(s.title).title;

  const add = () => {
    if (!chosen || chosen.stock <= 0) return;
    addToCart({
      productId: s.productId,
      variationId: chosen.id,
      title: s.title,
      imageUrl: s.imageUrl,
      variationName: `${chosen.variationType}: ${chosen.variationValue}`,
      price: price.regular,
      listPrice: s.listPrice ? s.listPrice + chosen.extraPrice : null,
      bulk: s.bulk,
      quantity: 1,
      rules: { couponAllowed: s.couponAllowed, pickupPct: s.pickupPct, transferPct: s.transferPct, complementOf: s.rules },
    });
    toast.success("Sepete eklendi", { ...toastHref("/sepet"), description: `1x ${shown}` });
    setPicking(false);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      <Link href={href} aria-label={`${shown} ürün sayfası`} className="block aspect-square bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
        {s.imageUrl && <img src={smallImage(s.imageUrl)} alt={shown} width={320} height={320} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
      </Link>
      <div className="flex-1 flex flex-col p-3 gap-2">
        <Link href={href} className="text-sm font-serif font-bold text-neutral-900 leading-snug line-clamp-2 hover:text-amber-700">
          {shown}
        </Link>
        <div className="mt-auto">
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span className="text-base font-bold text-neutral-900 tabular-nums">{tl(price.unit)} ₺</span>
            {price.discount > 0 && <span className="text-xs text-neutral-400 line-through tabular-nums">{tl(price.regular)} ₺</span>}
          </div>
          {price.discount > 0 && <p className="text-[11px] font-medium text-emerald-800">Birlikte alınca {tl(price.discount)} ₺ indirim</p>}
        </div>
        {picking && !single && (
          <div role="group" aria-label={`${shown} seçenekleri`} className="flex flex-wrap gap-1.5">
            {s.variations.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stock <= 0}
                aria-pressed={chosen?.id === v.id}
                onClick={() => setChosenId(v.id)}
                className={`text-xs px-2.5 py-1 rounded-md border min-h-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${
                  chosen?.id === v.id ? "border-amber-600 bg-amber-50 text-amber-900 font-semibold" : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                } disabled:opacity-40 disabled:line-through`}
              >
                {v.variationValue}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={single || picking ? add : () => setPicking(true)}
          disabled={(single || picking) && (!chosen || chosen.stock <= 0)}
          className="w-full flex items-center justify-center gap-1.5 bg-neutral-900 hover:bg-amber-600 disabled:bg-neutral-300 text-white text-xs font-semibold px-3 py-2.5 min-h-10 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          {single || picking ? "Sepete ekle" : "Seçenek seç"}
        </button>
      </div>
    </div>
  );
}
