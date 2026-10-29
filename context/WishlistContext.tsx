"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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

  const isFavorite = (productId: string) => {
    return favorites.some((item) => item.id === productId);
  };

  return (
    <WishlistContext.Provider
      value={{
        favorites,
        toggleFavorite,
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