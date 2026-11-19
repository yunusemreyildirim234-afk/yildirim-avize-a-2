"use client";

import { useState } from "react";
import { toast as notify } from "sonner";
import { toastHref } from "@/lib/toast-link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { pickDefaultOption } from "@/lib/default-variation";
import type { BulkRule } from "@/lib/bulk-pricing";
import type { LadderStep } from "@/lib/price-ladder";
import { productPath } from "@/lib/product-url";

export interface QuickProduct {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  listPrice?: number | null; // varyasyon farkı eklenmemiş liste fiyatı
  imageUrl?: string | null;
  modelCode?: string | null;
  bulk?: BulkRule[] | null;
  ladder?: LadderStep[]; // fiyat merdiveni (API'den)
  variations: { id: string; variationValue: string; extraPrice: number; stock: number; images?: string[] }[];
}

/** Favorilere ekle/çıkar kalbi. Eklenince yanında kapatılabilir "Favorilere Git" balonu açılır. */
export function FavoriteButton({ product, className = "" }: { product: QuickProduct; className?: string }) {
  const { isFavorite, toggleFavorite } = useWishlist();
  const [bubble, setBubble] = useState(false);
  const fav = isFavorite(product.id);

  const onToggle = () => {
    toggleFavorite({
      id: product.id,
      title: product.title,
      category: product.category,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl,
    });
    setBubble(!fav);
    notify(fav ? "Favorilerden çıkarıldı" : "Favorilere eklendi", { description: product.title, ...toastHref("/favorilerim") });
  };

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={fav}
        aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"}
        className="w-11 h-11 sm:w-8 sm:h-8 rounded-full bg-raised/90 hover:bg-raised shadow-md flex items-center justify-center transition-transform active:scale-90"
      >
        <Heart aria-hidden="true" className={`w-4 h-4 ${fav ? "fill-sale text-sale" : "text-ink-muted"}`} />
      </button>
      {fav && bubble && (
        <div className="flex items-center gap-1 rounded-full bg-ink text-canvas text-[11px] font-semibold pl-2.5 pr-1 py-1 shadow-md whitespace-nowrap">
          <Link href="/favorilerim" className="hover:underline">
            Favorilere Git
          </Link>
          <button
            type="button"
            onClick={() => setBubble(false)}
            aria-label="Bildirimi kapat"
            className="relative rounded-full p-0.5 hover:bg-canvas/20 after:absolute after:-inset-3 after:content-['']"
          >
            <X aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Hızlı sepete ekle ve adet artır/azalt. "+" sonrası yeşil "Sepete Git" mini bildirimi açılır. */
/** Ürün sepetteyse "Sepetinizde" etiketi (favoriler gibi listelerde; yalnızca istemci sepet durumu, sorgu yok). */
export function InCartBadge({ productId }: { productId: string }) {
  const { cart } = useCart();
  const qty = cart.filter((i) => i.productId === productId).reduce((n, i) => n + i.quantity, 0);
  if (qty === 0) return null;
  return (
    <Link href="/sepet" data-testid="sepetinizde-etiket" className="inline-flex w-fit items-center rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:underline">
      Sepetinizde ({qty})
    </Link>
  );
}

export function CartStepper({ product, inlineToast = false }: { product: QuickProduct; inlineToast?: boolean }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const router = useRouter();
  const [toast, setToast] = useState(false);

  const inCart = cart.find((i) => i.productId === product.id);
  const variation = product.variations.find((v) => v.id === inCart?.variationId) ?? pickDefaultOption(product.variations); // ürün sayfasıyla aynı varsayılan seçenek (lib/default-variation.ts)

  if (!variation || variation.stock <= 0) {
    return (
      <button type="button" disabled className="w-full rounded-xl bg-surface text-ink-subtle text-xs font-semibold py-2">
        Tükendi
      </button>
    );
  }

  const quantity = inCart?.quantity ?? 0;

  const increase = () => {
    // Seçenekli (renk/boyut) ürün: seçenek seçilmeden sepete eklenmez, ürün sayfasına gidilir
    if (!inCart && product.variations.length > 1) {
      router.push(productPath(product));
      return;
    }
    if (quantity >= variation.stock) return;
    if (inCart) updateQuantity(variation.id, quantity + 1);
    else
      addToCart({
        productId: product.id,
        variationId: variation.id,
        title: product.title,
        imageUrl: product.imageUrl, // kapak (ProductCard coverImageOf ile verir)
        variationName: variation.variationValue,
        price: product.basePrice + variation.extraPrice,
        listPrice: product.listPrice && product.listPrice > product.basePrice ? product.listPrice + variation.extraPrice : null,
        bulk: product.bulk,
        quantity: 1,
      });
    if (!inCart) notify.success("Sepete eklendi", { description: product.title, ...toastHref("/sepet") });
    setToast(true);
  };

  const decrease = () => updateQuantity(variation.id, quantity - 1);

  return (
    <div className="relative">
      {toast && quantity > 0 && (
        <div className={`${inlineToast ? "mb-1.5 w-fit" : "absolute bottom-full left-0 mb-2 z-10"} flex items-center gap-1 rounded-full bg-ink text-canvas text-[11px] font-semibold pl-2.5 pr-1 py-1 shadow-md whitespace-nowrap`}>
          <Link href="/sepet" className="hover:underline">
            Sepete Git
          </Link>
          <button
            type="button"
            onClick={() => setToast(false)}
            aria-label="Bildirimi kapat"
            className="relative rounded-full p-0.5 hover:bg-canvas/20 after:absolute after:-inset-3 after:content-['']"
          >
            <X aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-line-strong bg-raised text-ink overflow-hidden">
        <button
          type="button"
          onClick={decrease}
          disabled={quantity === 0}
          aria-label="Adedi azalt"
          className={`min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center px-3 py-2 hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent ${quantity === 0 ? "max-sm:hidden" : ""}`}
        >
          <Minus aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
        {quantity === 0 ? (
          <button type="button" onClick={increase} aria-label={`Sepete Ekle: ${product.title}`} className="flex-1 self-stretch min-h-11 sm:min-h-0 text-center whitespace-nowrap text-[11px] sm:text-xs font-bold hover:bg-surface">
            Sepete Ekle
          </button>
        ) : (
          <span className="flex-1 text-center whitespace-nowrap text-[11px] sm:text-xs font-bold tabular-nums" aria-live="polite">
            {quantity}
          </span>
        )}
        <button
          type="button"
          onClick={increase}
          disabled={quantity >= variation.stock}
          aria-label="Adedi artır"
          className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center px-2.5 sm:px-3 py-2 hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Plus aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
