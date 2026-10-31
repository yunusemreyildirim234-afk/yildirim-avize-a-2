"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";

/** Havale siparişi: dekont uyarısı, tek tıkla inceleme ve ödemeyi onaylama. */
export default function AdminReceiptActions({
  orderId,
  hasReceipt,
  senderName,
}: {
  orderId: string;
  hasReceipt: boolean;
  senderName?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!window.confirm("Havale ödemesini onaylayıp siparişi hazırlanıyor durumuna almak istiyor musunuz?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Onaylanamadı.");
      toast.success("Ödeme onaylandı", { description: "Sipariş hazırlanıyor durumuna alındı." });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2 space-y-1.5">
      {hasReceipt ? (
        <span className="inline-block bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
          Dekont Yüklendi
        </span>
      ) : (
        <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
          Havale Onayı Bekleniyor
        </span>
      )}
      {senderName && <p className="text-[11px] text-neutral-500">Gönderici: {senderName}</p>}
      <div className="flex flex-wrap gap-1.5">
        {hasReceipt && (
          <a
            href={`/api/receipts/${orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold border border-neutral-300 hover:bg-neutral-50 rounded-lg px-2.5 py-1.5"
          >
            <FileText aria-hidden="true" className="w-3 h-3" /> Dekontu İncele
          </a>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-2.5 py-1.5"
        >
          {busy ? "Onaylanıyor..." : "Ödemeyi Onayla"}
        </button>
      </div>
    </div>
  );
}
