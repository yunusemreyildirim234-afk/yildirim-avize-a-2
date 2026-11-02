"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Kargodaki siparişlerin durumunu Kargonomi'den çeker; teslim edilenleri "Teslim edildi" yapar (en fazla 50 sipariş/çağrı). */
export default function AdminShipmentSync() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kargonomi/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Senkronizasyon başarısız.");
      toast.success(`${data.checked} kargo kontrol edildi`, {
        description: `${data.delivered} sipariş teslim edildi olarak güncellendi${data.failed ? `, ${data.failed} sipariş sorgulanamadı` : ""}.`,
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      className="text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
    >
      {loading ? "Senkronize ediliyor..." : "🔄 Kargodaki siparişleri senkronize et"}
    </button>
  );
}
