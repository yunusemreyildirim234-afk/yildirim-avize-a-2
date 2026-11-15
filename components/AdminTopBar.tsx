"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, LayoutDashboard, LogOut } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Yönetim paneli üst çubuğu: /admin altında mağaza menüsünün yerine gösterilir (app/layout.tsx → HideOnAdmin).
 * "Yönetici çıkışı" yalnızca yönetici oturumunu kapatır (/api/admin/logout); aynı tarayıcıdaki müşteri oturumu açık kalır.
 * <header class="sticky"> olması bilerek: AdminSectionNav yapışkan çubuğunu bu başlığın yüksekliğine göre konumlar.
 */
export default function AdminTopBar() {
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/logout", { method: "POST" });
      if (!res.ok && res.status !== 401) throw new Error(); // 401: oturum zaten kapalı
      window.location.href = "/giris?tab=yonetici";
    } catch {
      toast.error("Çıkış yapılamadı. Lütfen tekrar deneyin.");
      setBusy(false);
    }
  };

  return (
    <header className="print:hidden sticky top-0 z-50 w-full bg-white text-neutral-900 border-b border-neutral-200 dark:bg-neutral-900 dark:text-white dark:border-neutral-800 keep-theme">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 min-h-14">
        <span className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <LayoutDashboard aria-hidden="true" className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" /> Yönetim Paneli
        </span>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Zil açık zemine göre tasarlandığı için açık renkli bir yuvada durur */}
          <span className="rounded-full bg-neutral-100 text-neutral-900 dark:bg-white">
            <NotificationBell />
          </span>
          {/* Sitedeki tema düğmesinin aynısı (aynı depolama anahtarı ve <html class="dark">); açık temada açık, koyu temada koyu zeminli (keep-theme: koyu çubuk ham renk ölçeğiyle çizilir) */}
          <ThemeToggle className="border border-neutral-300 text-neutral-800 hover:border-amber-600 hover:text-amber-700 dark:border-neutral-600 dark:text-white dark:hover:border-amber-400 dark:hover:text-amber-300" />
          <Link
            href="/"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 max-sm:px-2.5 text-xs font-semibold text-neutral-800 dark:text-white hover:border-amber-600 hover:text-amber-700 dark:hover:border-amber-400 dark:hover:text-amber-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ExternalLink aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> <span className="max-sm:sr-only">Siteyi gör</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            aria-label="Yönetici çıkışı"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-neutral-900 text-white hover:bg-amber-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-amber-400 px-3 max-sm:px-2.5 text-xs font-semibold disabled:opacity-60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <LogOut aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> {busy ? "Çıkılıyor..." : <><span className="max-sm:hidden">Yönetici çıkışı</span><span className="sm:hidden">Çıkış</span></>}
          </button>
        </div>
      </div>
    </header>
  );
}
