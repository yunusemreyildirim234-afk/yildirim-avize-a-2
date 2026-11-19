"use client";

import { useEffect } from "react";
import { THEME_KEY } from "@/components/ThemeToggle";

/** Kayıtlı tema tercihini <html> üzerine yeniden uygular (app/layout.tsx'teki ilk boyama betiğiyle aynı kural: varsayılan açık, yalnız "dark" kaydı koyu). 404 gibi sonradan işlenen sayfalarda sınıf eksik kalırsa düzeltir. */
export default function ThemeSync() {
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === "dark") document.documentElement.classList.add("dark");
    } catch {
      // depolama kapalıysa değişiklik yapılmaz
    }
  }, []);
  return null;
}
