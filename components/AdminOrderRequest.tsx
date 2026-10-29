"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  type: string | null;
  status: string | null;
  reason: string | null;
}

// Müşterinin iptal/iade talebi: yönetici onaylar veya reddeder
export default function AdminOrderRequest({ orderId, type, status, reason }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  if (!type || !status) return null;
  const label = type === "CANCEL" ? "İptal" : "İade";

  const decide = async (decision: "APPROVE" | "REJECT") => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/order-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, decision, note }),
      });
      const data = await res.json();
      if (res.ok) router.refresh();
      else alert(data.error || "İşlem başarısız.");
    } catch {
      alert("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "APPROVED" || status === "REJECTED") {
    const ok = status === "APPROVED";
    return (
      <span
        className={`inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full ${
          ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
        }`}
      >
        {label} talebi {ok ? "onaylandı" : "onaylanmadı"}
      </span>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-red-300 bg-red-50 p-3 space-y-2 max-w-[260px]">
      <p className="text-[11px] font-bold text-red-800">⚠ {label} talebi bekliyor</p>
      {reason && <p className="text-[11px] text-red-900 whitespace-pre-line">&ldquo;{reason}&rdquo;</p>}
      <input
        aria-label="Müşteriye not"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Müşteriye not (opsiyonel)"
        className="w-full text-[11px] px-2 py-1.5 rounded-lg border border-red-200 bg-white focus:outline-none focus:border-red-400"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => decide("APPROVE")}
          className="flex-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg disabled:opacity-60"
        >
          Onayla
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => decide("REJECT")}
          className="flex-1 text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg disabled:opacity-60"
        >
          Reddet (Onaylama)
        </button>
      </div>
    </div>
  );
}
