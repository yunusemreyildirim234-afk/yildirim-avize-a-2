"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  order: {
    id: string;
    shippingType: string;
    kargonomiShipmentId: number | null;
    kargonomiStatusLabel: string | null;
    shippingTrackingCode: string | null;
    shippingBarcode: string | null;
  };
}

export default function AdminKargonomiOrderActions({ order }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"create" | "refresh" | null>(null);
  const [error, setError] = useState("");

  if (order.shippingType === "BEYOGLU_MAGAZA_TESLIM") {
    return <span className="text-[11px] text-neutral-400">Mağaza teslimi – kargo gerekmiyor</span>;
  }

  const call = async (kind: "create" | "refresh") => {
    setLoading(kind);
    setError("");
    try {
      const res = await fetch("/api/admin/kargonomi/shipment", {
        method: kind === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "İşlem başarısız.");
      else router.refresh();
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(null);
    }
  };

  const btn = "text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50";

  return (
    <div className="space-y-2 min-w-[11rem]">
      {order.kargonomiShipmentId ? (
        <>
          <div className="text-[11px] space-y-0.5">
            <span className="block font-bold text-emerald-800">
              #{order.kargonomiShipmentId} • {order.kargonomiStatusLabel || "Taslak"}
            </span>
            {order.shippingTrackingCode && (
              <span className="block font-mono text-neutral-500">Takip: {order.shippingTrackingCode}</span>
            )}
            {order.shippingBarcode && (
              <span className="block font-mono text-neutral-500">Barkod: {order.shippingBarcode}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => call("refresh")}
              aria-label="Kargo durumunu yenile"
              className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50`}
            >
              {loading === "refresh" ? "Yenileniyor..." : "Durumu Yenile"}
            </button>
            <a
              href={`/api/admin/kargonomi/barcode?orderId=${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Kargo barkodunu aç"
              className={`${btn} bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100`}
            >
              Barkod
            </a>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => call("create")}
          aria-label="Kargonomi gönderisi oluştur"
          className={`${btn} bg-neutral-900 border-neutral-900 text-white hover:bg-amber-600 hover:border-amber-600`}
        >
          {loading === "create" ? "Oluşturuluyor..." : "Gönderi Oluştur"}
        </button>
      )}
      {error && <p className="text-[11px] text-red-600 max-w-[16rem]">{error}</p>}
    </div>
  );
}
