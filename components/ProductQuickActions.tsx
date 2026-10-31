"use client";

import { useState } from "react";
import { toast as notify } from "sonner";
import Link from "next/link";
import { Heart, Minus, Plus, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

export interface QuickProduct {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  imageUrl?: string | null;
  variations: { id: string; variationValue: string; extraPrice: number; stock: number }[];
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
    notify(fav ? "Favorilerden çıkarıldı" : "Favorilere eklendi", { description: product.title });
  };

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={fav}
        aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"}
        className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-transform active:scale-90"
      >
        <Heart aria-hidden="true" className={`w-4 h-4 ${fav ? "fill-red-600 text-red-600" : "text-zinc-600"}`} />
      </button>
      {fav && bubble && (
        <div className="flex items-center gap-1 rounded-full bg-red-600 text-white text-[11px] font-semibold pl-2.5 pr-1 py-1 shadow-md whitespace-nowrap">
          <Link href="/favorilerim" className="hover:underline">
            Favorilere Git
          </Link>
          <button
            type="button"
            onClick={() => setBubble(false)}
            aria-label="Bildirimi kapat"
            className="rounded-full p-0.5 hover:bg-white/20"
          >
            <X aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Hızlı sepete ekle ve adet artır/azalt. "+" sonrası yeşil "Sepete Git" mini bildirimi açılır. */
export function CartStepper({ product, inlineToast = false }: { product: QuickProduct; inlineToast?: boolean }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const [toast, setToast] = useState(false);

  const inCart = cart.find((i) => i.productId === product.id);
  const variation = product.variations.find((v) => v.id === inCart?.variationId) ?? product.variations.find((v) => v.stock > 0);

  if (!variation || variation.stock <= 0) {
    return (
      <button type="button" disabled className="w-full rounded-xl bg-zinc-100 text-zinc-400 text-xs font-semibold py-2">
        Tükendi
      </button>
    );
  }

  const quantity = inCart?.quantity ?? 0;

  const increase = () => {
    if (quantity >= variation.stock) return;
    if (inCart) updateQuantity(variation.id, quantity + 1);
    else
      addToCart({
        productId: product.id,
        variationId: variation.id,
        title: product.title,
        imageUrl: product.imageUrl,
        variationName: variation.variationValue,
        price: product.basePrice + variation.extraPrice,
        quantity: 1,
      });
    if (!inCart) notify.success("Sepete eklendi", { description: product.title });
    setToast(true);
  };

  const decrease = () => updateQuantity(variation.id, quantity - 1);

  return (
    <div className="relative">
      {toast && quantity > 0 && (
        <div className={`${inlineToast ? "mb-1.5 w-fit" : "absolute bottom-full left-0 mb-2 z-10"} flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold pl-2.5 pr-1 py-1 shadow-md whitespace-nowrap`}>
          <Link href="/sepet" className="hover:underline">
            Sepete Git
          </Link>
          <button
            type="button"
            onClick={() => setToast(false)}
            aria-label="Bildirimi kapat"
            className="rounded-full p-0.5 hover:bg-white/20"
          >
            <X aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-zinc-300 bg-white text-zinc-900 overflow-hidden">
        <button
          type="button"
          onClick={decrease}
          disabled={quantity === 0}
          aria-label="Adedi azalt"
          className="px-3 py-2 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Minus aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-bold tabular-nums" aria-live="polite">
          {quantity === 0 ? "Sepete Ekle" : quantity}
        </span>
        <button
          type="button"
          onClick={increase}
          disabled={quantity >= variation.stock}
          aria-label="Adedi artır"
          className="px-3 py-2 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Plus aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
