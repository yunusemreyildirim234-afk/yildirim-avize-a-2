"use client";

import { usePathname } from "next/navigation";

/** Yönetim paneli (/admin) adreslerinde mağaza kabuğunu (üst menü, alt bilgi) gizler; yerine `fallback` (ör. admin üst çubuğu) gösterir. */
export default function HideOnAdmin({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return usePathname()?.startsWith("/admin") ? fallback : children;
}
