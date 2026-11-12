"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, LayoutDashboard, LogOut } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

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
    <header className="print:hidden sticky top-0 z-50 w-full bg-neutral-900 text-white border-b border-neutral-800 keep-theme">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 min-h-14">
        <span className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <LayoutDashboard aria-hidden="true" className="w-4 h-4 text-amber-400 shrink-0" /> Yönetim Paneli
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Zil açık zemine göre tasarlandığı için açık renkli bir yuvada durur */}
          <span className="rounded-full bg-white text-neutral-900">
            <NotificationBell />
          </span>
          <Link
            href="/"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-600 px-3 text-xs font-semibold text-white hover:border-amber-400 hover:text-amber-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ExternalLink aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> Siteyi gör
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-neutral-900 hover:bg-amber-400 disabled:opacity-60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <LogOut aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> {busy ? "Çıkılıyor..." : "Yönetici çıkışı"}
          </button>
        </div>
      </div>
    </header>
  );
}
