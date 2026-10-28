"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "ya-theme";

// <html class="dark"> durumunu dinler; ilk boyamadan önce layout'taki script ayarlar
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // depolama kapalıysa tercih yalnızca bu oturumda geçerli olur
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Aydınlık moda geç" : "Koyu moda geç"}
      title={dark ? "Aydınlık mod" : "Koyu mod"}
      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 hover:bg-zinc-100 transition-colors"
    >
      {dark ? <Sun aria-hidden="true" className="w-5 h-5" /> : <Moon aria-hidden="true" className="w-5 h-5" />}
    </button>
  );
}
