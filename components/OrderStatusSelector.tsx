"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  initialStatus: string;
  shippingType: string;
}

export default function OrderStatusSelector({ orderId, initialStatus, shippingType }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        toast.error("Durum güncellenemedi", { description: data.error });
      }
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const isBeyoglu = shippingType === "BEYOGLU_MAGAZA_TESLIM";

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Sipariş durumu"
        disabled={loading}
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-all ${
          status === "PENDING"
            ? "bg-amber-50 text-amber-900 border-amber-300"
            : status === "READY_FOR_PICKUP"
            ? "bg-purple-50 text-purple-900 border-purple-300"
            : status === "SHIPPED"
            ? "bg-blue-50 text-blue-900 border-blue-300"
            : status === "CANCELLED" || status === "RETURNED"
            ? "bg-red-50 text-red-900 border-red-300"
            : "bg-emerald-50 text-emerald-900 border-emerald-300"
        }`}
      >
        <option value="PENDING">⏳ Hazırlanıyor</option>

        {isBeyoglu ? (
          <option value="READY_FOR_PICKUP">📍 Mağazada Teslime Hazır</option>
        ) : (
          <option value="SHIPPED">📦 Kargoya Verildi</option>
        )}

        <option value="DELIVERED">✓ Teslim Edildi</option>
        <option value="CANCELLED">✕ İptal Edildi</option>
        <option value="RETURNED">↩ İade Edildi</option>
      </select>

      {loading && <span className="text-[10px] text-neutral-400 animate-spin">⌛</span>}
    </div>
  );
}