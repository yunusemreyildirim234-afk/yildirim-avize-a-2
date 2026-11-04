"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { toastHref } from "@/lib/toast-link";
import { useAccountSync } from "@/context/useAccountSync";

export interface WishlistItem {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  imageUrl?: string | null;
}

interface WishlistContextType {
  favorites: WishlistItem[];
  toggleFavorite: (product: WishlistItem) => void;
  removeFavoriteUndoable: (product: WishlistItem) => void;
  clearFavorites: () => void;
  isFavorite: (productId: string) => boolean;
  totalFavorites: number;
}

function mergeFavorites(local: WishlistItem[], remote: WishlistItem[]): WishlistItem[] {
  const ids = new Set(remote.map((i) => i.id));
  return [...remote, ...local.filter((i) => !ids.has(i.id))];
}

const serializeFavorites = (list: WishlistItem[]) => list.map((i) => ({ id: i.id }));

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("yildirim_wishlist");
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- istemci depolamasını ilk render sonrası okumak gerekir (hydration)
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("yildirim_wishlist", JSON.stringify(favorites));
    }
  }, [favorites, isLoaded]);

  useAccountSync({ endpoint: "/api/favorites", list: favorites, setList: setFavorites, merge: mergeFavorites, serialize: serializeFavorites, ready: isLoaded });

  const toggleFavorite = (product: WishlistItem) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      }
      return [...prev, product];
    });
  };

  // Listeden çıkarma + 6 saniyelik geri alma
  const removeFavoriteUndoable = (product: WishlistItem) => {
    setFavorites((prev) => prev.filter((i) => i.id !== product.id));
    toast("Favorilerden çıkarıldı", {
      ...toastHref("/favorilerim"),
      description: product.title,
      duration: 6000,
      action: { label: "↩ Geri Al", onClick: () => setFavorites((prev) => (prev.some((i) => i.id === product.id) ? prev : [...prev, product])) },
    });
  };

  const clearFavorites = () => {
    const removed = favorites;
    if (removed.length === 0) return;
    setFavorites([]);
    toast("Favoriler temizlendi", {
      ...toastHref("/favorilerim"),
      description: `${removed.length} ürün çıkarıldı`,
      duration: 6000,
      action: { label: "↩ Geri Al", onClick: () => setFavorites((prev) => (prev.length === 0 ? removed : prev)) },
    });
  };

  const isFavorite = (productId: string) => {
    return favorites.some((item) => item.id === productId);
  };

  return (
    <WishlistContext.Provider
      value={{
        favorites,
        toggleFavorite,
        removeFavoriteUndoable,
        clearFavorites,
        isFavorite,
        totalFavorites: favorites.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist, WishlistProvider içinde kullanılmalıdır.");
  }
  return context;
}