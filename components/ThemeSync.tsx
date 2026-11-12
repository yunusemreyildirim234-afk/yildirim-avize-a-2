"use client";

import { useEffect } from "react";
import { THEME_KEY } from "@/components/ThemeToggle";

/** Kayıtlı/sistem tema tercihini <html> üzerine yeniden uygular (app/layout.tsx'teki ilk boyama betiğiyle aynı kural). 404 gibi sonradan işlenen sayfalarda sınıf eksik kalırsa düzeltir. */
export default function ThemeSync() {
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark");
    } catch {
      // depolama kapalıysa değişiklik yapılmaz
    }
  }, []);
  return null;
}
