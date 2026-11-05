"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MonitorSmartphone } from "lucide-react";

export default function AdminSessions() {
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!confirm("Bu cihaz dışındaki TÜM yönetici oturumları kapatılacak (diğer cihazlarda yeniden giriş gerekir). Devam edilsin mi?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sessions", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success("Diğer tüm yönetici oturumları kapatıldı.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="oturumlar" className="scroll-mt-[var(--admin-offset,6rem)] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2"><MonitorSmartphone aria-hidden="true" className="w-4 h-4 text-amber-600" /> Yönetici Oturumları</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Şüpheli bir durumda tüm cihazlardaki yönetici oturumlarını kapatın. Bu cihazdaki oturumunuz açık kalır.</p>
      </div>
      <button type="button" onClick={revoke} disabled={busy} className="bg-neutral-900 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
        {busy ? "Kapatılıyor..." : "Tüm yönetici oturumlarını kapat"}
      </button>
    </div>
  );
}
