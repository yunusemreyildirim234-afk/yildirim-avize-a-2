"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { forgetCardOrder } from "@/lib/pending-card-order";

// Sipariş onay sayfası açıldığında sepeti temizler
export default function ClearCart({ orderId, createdAt }: { orderId: string; createdAt: string }) {
  const { clearCart } = useCart();
  useEffect(() => {
    forgetCardOrder(); // sipariş sayfasına geçildi: bekleyen kartlı sipariş kaydı silinir
    // Aynı sipariş sayfası tekrar açıldığında (ör. sonradan sepete eklenen ürünler) sepet silinmez
    // 2 saatten eski siparişlerin sayfası sepeti silmez
    if (Date.now() - new Date(createdAt).getTime() > 2 * 60 * 60 * 1000) return;
    const key = `ya-cart-cleared-${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // depolama kapalıysa yine de bir kez çalışır
    }
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca ilk açılışta çalışmalı
  }, []);
  return null;
}
