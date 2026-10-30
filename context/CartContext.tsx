"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAccountSync } from "@/context/useAccountSync";

export interface CartItem {
  productId: string;
  variationId: string;
  title: string;
  imageUrl?: string | null;
  variationName: string;
  price: number;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (variationId: string) => void;
  updateQuantity: (variationId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

// Girişte misafir sepeti hesap sepetiyle birleşir; aynı üründe büyük olan adet korunur
function mergeCarts(local: CartItem[], remote: CartItem[]): CartItem[] {
  const merged = new Map(remote.map((i) => [i.variationId, i]));
  for (const item of local) {
    const other = merged.get(item.variationId);
    if (!other) merged.set(item.variationId, item);
    else if (item.quantity > other.quantity) merged.set(item.variationId, { ...other, quantity: item.quantity });
  }
  return [...merged.values()];
}

const serializeCart = (cart: CartItem[]) => cart.map((i) => ({ variationId: i.variationId, quantity: i.quantity }));

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Tarayıcı hafızasından mevcut sepeti yükle
  useEffect(() => {
    const saved = localStorage.getItem("yildirim_cart");
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- istemci depolamasını ilk render sonrası okumak gerekir (hydration)
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Sepet her değiştiğinde tarayıcıya kaydet
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("yildirim_cart", JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  useAccountSync({ endpoint: "/api/cart", list: cart, setList: setCart, merge: mergeCarts, serialize: serializeCart, ready: isLoaded });

  const addToCart = (newItem: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.variationId === newItem.variationId);
      if (existing) {
        return prev.map((item) =>
          item.variationId === newItem.variationId
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        );
      }
      return [...prev, newItem];
    });
  };

  const removeFromCart = (variationId: string) => {
    setCart((prev) => prev.filter((item) => item.variationId !== variationId));
  };

  const updateQuantity = (variationId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variationId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.variationId === variationId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart, CartProvider içinde kullanılmalıdır.");
  }
  return context;
}