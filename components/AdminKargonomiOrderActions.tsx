"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  order: {
    id: string;
    status: string;
    shippingType: string;
    kargonomiShipmentId: number | null;
    kargonomiStatusLabel: string | null;
    shippingTrackingCode: string | null;
    shippingBarcode: string | null;
    shippingProviderName: string | null;
    barcodeUrl: string | null;
    labelCreated: boolean;
  };
}

export default function AdminKargonomiOrderActions({ order }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"create" | "regenerate" | "refresh" | null>(null);

  if (order.shippingType === "BEYOGLU_MAGAZA_TESLIM") {
    return <span className="text-[11px] text-neutral-400">Mağaza teslimi – kargo gerekmiyor</span>;
  }

  const run = async (kind: "create" | "regenerate" | "refresh") => {
    if (kind === "regenerate" && !window.confirm("Yeni bir Aras Kargo gönderisi açılacak. Eski gönderiyi Kargonomi panelinden iptal etmeniz gerekir. Devam edilsin mi?")) return;
    setLoading(kind);
    try {
      const res = await (kind === "refresh"
        ? fetch("/api/admin/kargonomi/shipment", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
          })
        : fetch(`/api/admin/orders/${order.id}/create-shipping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ regenerate: kind === "regenerate" }),
          }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success(kind === "refresh" ? "Kargo durumu güncellendi" : "Aras Kargo barkodu hazır");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "Bağlantı hatası oluştu.");
    } finally {
      setLoading(null);
    }
  };

  const btn = "text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50";
  const tracking = order.shippingTrackingCode || order.shippingBarcode;
  const payable = ["PENDING", "SHIPPED"].includes(order.status);

  if (!order.labelCreated) {
    return (
      <div className="space-y-1.5 min-w-[11rem]">
        <button
          type="button"
          disabled={loading !== null || !payable}
          onClick={() => run("create")}
          className={`${btn} bg-orange-600 border-orange-600 text-white hover:bg-orange-700`}
        >
          {loading === "create" ? "Barkod oluşturuluyor..." : "Aras Kargo Barkodu Oluştur"}
        </button>
        {!payable && <p className="text-[10px] text-neutral-400 max-w-[11rem]">Ödeme onaylanınca barkod oluşturulabilir.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-[11rem]">
      <div className="text-[11px] space-y-1">
        <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
          {order.shippingProviderName || "Aras Kargo"}
          {order.kargonomiShipmentId ? ` • #${order.kargonomiShipmentId}` : ""}
        </span>
        {tracking && <span className="block font-mono text-neutral-700">Takip No: {tracking}</span>}
        {order.kargonomiStatusLabel && <span className="block text-neutral-500">{order.kargonomiStatusLabel}</span>}
        {tracking && (
          <a
            href={`https://kargotakip.araskargo.com.tr/?kargotakipno=${encodeURIComponent(tracking)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-amber-700 underline"
          >
            Kargo hareketleri
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={order.barcodeUrl || `/api/admin/kargonomi/barcode?orderId=${order.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700`}
        >
          Barkod Yazdır (PDF)
        </a>
        <button type="button" disabled={loading !== null} onClick={() => run("refresh")} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
          {loading === "refresh" ? "Yenileniyor..." : "Durumu Yenile"}
        </button>
        <button type="button" disabled={loading !== null} onClick={() => run("regenerate")} className={`${btn} bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50`}>
          {loading === "regenerate" ? "Üretiliyor..." : "Barkodu Yeniden Üret"}
        </button>
      </div>
    </div>
  );
}
