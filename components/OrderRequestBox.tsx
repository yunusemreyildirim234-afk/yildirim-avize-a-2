"use client";

import { useState } from "react";

interface Props {
  order: {
    id: string;
    status: string;
    cancelReturnType?: string | null;
    cancelReturnStatus?: string | null;
    cancelReturnNote?: string | null;
  };
  onChanged: () => void;
}

const CANCELLABLE = ["PENDING", "PENDING_NEW"];
const RETURNABLE = ["SHIPPED", "READY_FOR_PICKUP", "DELIVERED"];

// Hesabım → Siparişlerim: iptal/iade talebi butonu ve talep sonucu rozetleri
export default function OrderRequestBox({ order, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const label = order.cancelReturnType === "RETURN" ? "İade" : "İptal";

  if (order.cancelReturnStatus === "PENDING") {
    return (
      <p className="text-[11px] font-semibold bg-amber-100 text-amber-900 rounded-xl px-3 py-2">
        {label} Talebiniz İnceleniyor
      </p>
    );
  }

  if (order.cancelReturnStatus === "APPROVED" || order.cancelReturnStatus === "REJECTED") {
    const ok = order.cancelReturnStatus === "APPROVED";
    return (
      <div
        className={`text-[11px] font-semibold rounded-xl px-3 py-2 ${
          ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
        }`}
      >
        {label} talebiniz {ok ? "onaylandı" : "onaylanmadı"}
        {order.cancelReturnNote && <span className="block font-normal mt-0.5">{order.cancelReturnNote}</span>}
      </div>
    );
  }

  const type = CANCELLABLE.includes(order.status) ? "CANCEL" : RETURNABLE.includes(order.status) ? "RETURN" : null;
  if (!type) return null;
  const actionLabel = type === "CANCEL" ? "İptal Talebi Gönder" : "İade Talebi Gönder";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpen(false);
        onChanged();
      } else {
        setError(data.error || "Talep gönderilemedi.");
      }
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded-xl px-3 py-2 transition-colors"
      >
        {actionLabel}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 text-[11px]">
      <textarea
        aria-label="Talep nedeni"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Nedeninizi kısaca yazın (opsiyonel)"
        className="w-full p-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
      />
      {error && <p className="text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl"
        >
          {loading ? "Gönderiliyor..." : actionLabel}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-neutral-500 font-semibold px-3 py-2">
          Vazgeç
        </button>
      </div>
    </form>
  );
}
