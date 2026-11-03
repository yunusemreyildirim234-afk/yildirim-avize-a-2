"use client";

import { useState } from "react";
import { toast } from "sonner";

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
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-bold text-neutral-900 text-sm">Yönetici Oturumları</h3>
        <p className="text-xs text-neutral-500 mt-0.5">Şüpheli bir durumda tüm cihazlardaki yönetici oturumlarını kapatın. Bu cihazdaki oturumunuz açık kalır.</p>
      </div>
      <button type="button" onClick={revoke} disabled={busy} className="bg-neutral-900 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
        {busy ? "Kapatılıyor..." : "Tüm yönetici oturumlarını kapat"}
      </button>
    </div>
  );
}
