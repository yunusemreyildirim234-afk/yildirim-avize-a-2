"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CopyTrackingCode from "@/components/CopyTrackingCode";
import { carrierDisplayName, carrierTrackingLink } from "@/lib/carrier-links";

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

interface Quote {
  providerId: number;
  name: string;
  priceText: string;
  available: boolean;
}
interface QuoteData {
  confirmed: boolean;
  providerId: number | null;
  quotes: Quote[];
  recommended: number | null;
  reason: string | null;
}

const NOTICE = "Barkod hazır. Paketi kargoya verince durumu 'Kargoya Verildi' yapın.";

export default function AdminKargonomiOrderActions({ order }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"create" | "regenerate" | "refresh" | null>(null);
  const [askCreate, setAskCreate] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  if (order.shippingType === "BEYOGLU_MAGAZA_TESLIM") {
    return <span className="text-[11px] text-neutral-500">Mağaza teslimi – kargo gerekmiyor</span>;
  }

  const loadQuotes = async () => {
    setAskCreate(true);
    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteData(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/kargonomi/quotes?orderId=${encodeURIComponent(order.id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Fiyatlar alınamadı.");
      setQuoteData(data as QuoteData);
      setSelected(data.confirmed ? (data.providerId ?? 4) : (data.recommended ?? null));
    } catch (err) {
      setQuoteError((err as Error).message || "Fiyatlar alınamadı.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const run = async (kind: "create" | "regenerate" | "refresh") => {
    // Barkodu yeniden üretmede firma değişmez: mevcut firma (Hepsijet değilse Aras) kullanılır
    const regenProvider = /hepsijet/i.test(order.shippingProviderName ?? "") ? 6 : 4;
    if (kind === "regenerate" && !window.confirm(`Yeni bir ${regenProvider === 6 ? "Hepsijet" : "Aras Kargo"} gönderisi açılacak. Eski gönderiyi Kargonomi panelinden iptal etmeniz gerekir. Devam edilsin mi?`)) return;
    setAskCreate(false);
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
            body: JSON.stringify({ regenerate: kind === "regenerate", providerId: kind === "regenerate" ? regenProvider : selected }),
          }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success(kind === "refresh" ? "Kargo durumu güncellendi" : NOTICE);
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

  // İptal/iade edilmiş siparişte barkod oluşturulamaz: düğme ve "ödeme onaylanınca" notu gösterilmez
  if (!order.labelCreated && ["CANCELLED", "RETURNED"].includes(order.status)) {
    return <span className="text-[11px] text-neutral-500">—</span>;
  }

  if (!order.labelCreated) {
    return (
      <div className="space-y-1.5 min-w-[11rem]">
        {askCreate ? (
          <div role="group" aria-label="Barkod oluşturma onayı" className="space-y-2 text-[11px] text-neutral-800">
            {quoteLoading && <p className="text-neutral-500">Fiyatlar alınıyor...</p>}
            {quoteError && (
              <div className="space-y-1.5">
                <p className="text-red-700 font-semibold">{quoteError}</p>
                <button type="button" onClick={loadQuotes} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
                  Tekrar dene
                </button>
              </div>
            )}
            {quoteData && !quoteData.confirmed && (
              <fieldset className="space-y-1">
                <legend className="font-semibold mb-1">Kargo firması</legend>
                {quoteData.quotes.map((q) => (
                  <label key={q.providerId} className={`flex items-start gap-2 ${q.available ? "cursor-pointer" : "opacity-60"}`}>
                    <input type="radio" name={`carrier-${order.id}`} className="mt-0.5" disabled={!q.available} checked={selected === q.providerId} onChange={() => setSelected(q.providerId)} />
                    <span>
                      {q.name} — {q.available ? q.priceText : "Hizmet dışı bölge"}
                    </span>
                  </label>
                ))}
                {quoteData.reason && <p className="text-neutral-500">{quoteData.reason}</p>}
                {!quoteData.recommended && <p className="text-red-700">İki firma da bu bölgeye hizmet vermiyor görünüyor; Kargonomi panelinden kontrol edin.</p>}
              </fieldset>
            )}
            {quoteData?.confirmed && <p className="font-semibold">Gönderi Kargonomi&apos;de zaten onaylı. Barkod bilgisi çekilsin mi?</p>}
            {quoteData && selected && !quoteData.confirmed && (
              <p className="font-semibold">
                Ücretli {selected === 6 ? "Hepsijet" : "Aras Kargo"} gönderisi açılır, {quoteData.quotes.find((q) => q.providerId === selected)?.priceText}. Oluşturulsun mu?
              </p>
            )}
            {quoteData && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!selected} onClick={() => run("create")} className={`${btn} bg-orange-600 border-orange-600 text-white hover:bg-orange-700`}>
                  Evet, oluştur
                </button>
                <button type="button" onClick={() => setAskCreate(false)} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
                  Vazgeç
                </button>
              </div>
            )}
            {!quoteData && (
              <button type="button" onClick={() => setAskCreate(false)} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>
                Vazgeç
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={loading !== null || !payable}
            onClick={loadQuotes}
            className={`${btn} bg-orange-600 border-orange-600 text-white hover:bg-orange-700`}
          >
            {loading === "create" ? "Barkod oluşturuluyor..." : "Kargo Barkodu Oluştur"}
          </button>
        )}
        {!payable && <p className="text-[10px] text-neutral-500 max-w-[11rem]">Ödeme onaylanınca barkod oluşturulabilir.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-[11rem]">
      <div className="text-[11px] space-y-1">
        <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
          {carrierDisplayName(order.shippingProviderName)}
          {order.kargonomiShipmentId ? ` • #${order.kargonomiShipmentId}` : ""}
        </span>
        {tracking && <span className="block text-neutral-700">Takip No: <CopyTrackingCode code={tracking} /></span>}
        {order.kargonomiStatusLabel && <span className="block text-neutral-500">{order.kargonomiStatusLabel}</span>}
        {order.status === "PENDING" && <span className="block text-amber-800">Paketi kargoya verince durumu &apos;Kargoya Verildi&apos; yapın.</span>}
        {tracking && carrierTrackingLink({ providerName: order.shippingProviderName, code: tracking }).href && (
          <a
            href={carrierTrackingLink({ providerName: order.shippingProviderName, code: tracking }).href ?? undefined}
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
