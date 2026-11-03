"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAccountSync } from "@/context/useAccountSync";
import { toast } from "sonner";
import { track } from "@/lib/track";
import { gtmPush } from "@/lib/gtm";
import { addToCartEvent, gaItem } from "@/lib/gtm-events";
import { bulkTiersOf, type BulkRule } from "@/lib/bulk-pricing";
import { priceCart, type CartPriceLine } from "@/lib/cart-pricing";

export interface CartItem {
  productId: string;
  variationId: string;
  title: string;
  imageUrl?: string | null;
  variationName: string;
  price: number;
  quantity: number;
  bulk?: BulkRule[] | null; // adet kademeleri
  rules?: ItemRules; // ürüne özel indirim kuralları (sunucu teklifinden gelir; yoksa varsayılan)
}

export interface ItemRules {
  couponAllowed: boolean;
  pickupPct: number | null;
  transferPct: number | null;
}

/** Sepet kalemlerini ortak fiyat hesabı (lib/cart-pricing.ts) girdisine çevirir. */
export const cartPriceLines = (cart: CartItem[]): CartPriceLine[] =>
  cart.map((i) => ({
    variationId: i.variationId,
    productId: i.productId,
    price: i.price,
    quantity: i.quantity,
    tiers: i.bulk ?? [],
    couponAllowed: i.rules?.couponAllowed ?? true,
    pickupPct: i.rules?.pickupPct ?? null,
    transferPct: i.rules?.transferPct ?? null,
  }));

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (variationId: string) => void;
  emptyCart: () => void; // kullanıcı eylemi: geri alınabilir
  updateQuantity: (variationId: string, quantity: number) => void;
  /** Sunucunun güncel birim fiyat/kademe bilgisini sepet kalemlerine yazar (bayat tarayıcı fiyatı korunmaz). */
  applyServerPrices: (updates: { variationId: string; price: number; bulk: BulkRule[]; rules?: ItemRules }[]) => void;
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
        setCart((JSON.parse(saved) as CartItem[]).map((i) => ({ ...i, bulk: bulkTiersOf(i.bulk) })));
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
    track("CART_ADD", `${newItem.title} (${newItem.variationName}) x${newItem.quantity}`);
    gtmPush(addToCartEvent([gaItem({ id: newItem.productId, name: newItem.title, price: newItem.price, quantity: newItem.quantity, variant: newItem.variationName })]));
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

  // Geri alınabilir ürün çıkarma: 6 saniye boyunca aynı adet ve varyasyonla geri eklenebilir
  const removeFromCart = (variationId: string) => {
    const index = cart.findIndex((item) => item.variationId === variationId);
    if (index < 0) return;
    const removed = cart[index];
    setCart((prev) => prev.filter((item) => item.variationId !== variationId));
    toast("Ürün sepetten çıkarıldı", {
      description: removed.title,
      duration: 6000,
      action: {
        label: "↩ Geri Al",
        onClick: () =>
          setCart((prev) => {
            if (prev.some((i) => i.variationId === removed.variationId)) return prev;
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
      },
    });
  };

  const emptyCart = () => {
    if (cart.length === 0) return;
    const removed = cart;
    setCart([]);
    toast("Sepet boşaltıldı", {
      description: `${removed.length} ürün çıkarıldı`,
      duration: 6000,
      action: { label: "↩ Geri Al", onClick: () => setCart((prev) => (prev.length === 0 ? removed : prev)) },
    });
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

  const applyServerPrices = (updates: { variationId: string; price: number; bulk: BulkRule[]; rules?: ItemRules }[]) => {
    const map = new Map(updates.map((u) => [u.variationId, u]));
    setCart((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const u = map.get(i.variationId);
        if (!u || (u.price === i.price && JSON.stringify(u.bulk) === JSON.stringify(i.bulk ?? []) && JSON.stringify(u.rules ?? null) === JSON.stringify(i.rules ?? null))) return i;
        changed = true;
        return { ...i, price: u.price, bulk: u.bulk, rules: u.rules ?? i.rules };
      });
      return changed ? next : prev;
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = priceCart({ lines: cartPriceLines(cart), shippingType: "STANDART_KARGO", paymentMethod: "CREDIT_CARD" }).itemsTotal;

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        emptyCart,
        updateQuantity,
        applyServerPrices,
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