"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminTrendyolSync() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const sync = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/trendyol/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Senkronizasyon başarısız.");
      const r = data.result;
      setFailed(false);
      setMessage(`${r.fetched} Trendyol kaydı → ${r.products} ürün, ${r.variations} varyasyon güncellendi.`);
      router.refresh();
    } catch (err) {
      setFailed(true);
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-neutral-900">Trendyol Ürünleri</h2>
        <p className={`text-xs mt-0.5 ${failed ? "text-red-600" : "text-neutral-600"}`} role="status">
          {message || "Mağazadaki tüm ürünleri, fiyat ve stokları Trendyol'dan çekip günceller."}
        </p>
      </div>
      <button
        type="button"
        onClick={sync}
        disabled={loading}
        className="text-xs font-semibold bg-neutral-900 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 w-fit"
      >
        {loading ? "Senkronize ediliyor..." : "Trendyol Ürünlerini Senkronize Et / Güncelle"}
      </button>
    </div>
  );
}
