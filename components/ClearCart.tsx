"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

// Sipariş onay sayfası açıldığında sepeti temizler
export default function ClearCart() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca ilk açılışta çalışmalı
  }, []);
  return null;
}
