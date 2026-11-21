"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { canTransition } from "@/lib/order-undo";

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
    // Onay metinleri koddan teyitli (app/api/admin/order-status, lib/shipped-notice.ts): Teslim -> yalnızca site içi bildirim; Kargo -> site içi bildirim, standart kargo + takip kodu varsa e-posta da gider; İptal/İade -> stok ve kupon iadesi (lib/order-undo.ts)
    const CONFIRM: Record<string, string> = {
      CANCELLED: "Stok ve kupon iade edilecek. Geri Al ile geri alınabilir.",
      ...(["CANCELLED", "PAYMENT_FAILED"].includes(status) ? { PENDING: "Sipariş yeniden açılacak: stok yeniden düşülecek (yetmezse işlem reddedilir) ve kupon hakkı yeniden kullanılmış sayılacak. Bu işlemin Geri Al'ı yoktur; vazgeçerseniz siparişi yeniden İptal yapın. Emin misiniz?" } : {}),
      RETURNED: "Sipariş 'İade Edildi' yapılacak; stok ve kupon iade edilecek (müşteriye bildirim gitmez). Emin misiniz?",
      DELIVERED: "Sipariş 'Teslim Edildi' yapılacak ve müşteriye site içi bildirim gidecek (e-posta gitmez). Emin misiniz?",
      SHIPPED: "Sipariş 'Kargoya Verildi' yapılacak ve müşteriye site içi bildirim gidecek ve takip kodu varsa e-posta da gönderilecek. Emin misiniz?",
    };
    if (CONFIRM[newStatus] && !confirm(CONFIRM[newStatus])) return; // onay verilmezse seçim eski değerinde kalır (kontrollü select)
    const previous = status;
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
        if (data.undoToken) {
          toast.success("Sipariş durumu güncellendi", {
            duration: 10000,
            action: { label: "↩ Geri Al", onClick: () => undoChange(data.undoToken, previous, Boolean(data.notified), newStatus) },
          });
        }
        router.refresh();
      } else {
        // Sunucu değişikliği reddetti (ör. eşzamanlı güncelleme): seçim eski duruma döner, güncel durum yeniden okunur
        setStatus(previous);
        toast.error("Durum güncellenemedi", { description: data.error });
        if (data.alreadyUpdated) router.refresh();
      }
    } catch {
      setStatus(previous);
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Geri Al: sunucu stok/kupon/durumu tek işlemde geri çevirir; reddederse nedeni gösterilir
  const undoChange = async (undoToken: string, previous: string, notified: boolean, changedTo: string) => {
    const notes = [
      notified ? "Müşteriye bildirim gitti; geri alma e-posta/bildirim göndermez." : "",
      ["CANCELLED", "RETURNED"].includes(changedTo) ? "İptal/iade geri alınırsa stok yeniden düşülür ve kupon hakkı yeniden kullanılmış sayılır." : "",
    ].filter(Boolean);
    if (!confirm("Sipariş durumu eski haline döndürülsün mü?" + (notes.length ? "\n\n" + notes.join("\n") : ""))) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/order-status/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ undoToken }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Geri alınamadı.");
      setStatus(previous);
      toast.success("Sipariş durumu geri alındı");
      if (data.couponWarning) toast.warning("Kupon uyarısı", { description: data.couponWarning, duration: 12000 });
      router.refresh();
    } catch (e) {
      toast.error("Geri alınamadı", { description: (e as Error).message });
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
          status === "PENDING" || status === "AWAITING_PAYMENT" || status === "PENDING_NEW"
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
        {(status === "AWAITING_PAYMENT" || status === "PAYMENT_FAILED" || status === "PENDING_NEW") && (
          <option value={status}>{status === "AWAITING_PAYMENT" ? "Ödeme Bekleniyor" : status === "PENDING_NEW" ? "Havale Onayı Bekleniyor" : "Ödeme Başarısız"}</option>
        )}
        {/* Bekleyen havalede "Hazırlanıyor" yalnızca durumu yazar; "Ödemeyi Onayla" ise ayrıca stok güvencesi, kargo kaydı ve "Ödemeniz onaylandı" bildirimini yapar (lib/orders.ts confirmBankPayment). Bu yüzden orada pasif. */}
        <option value="PENDING" disabled={!canTransition(status, "PENDING") || status === "PENDING_NEW"}>⏳ Hazırlanıyor{status === "PENDING_NEW" ? " (önce Ödemeyi Onayla)" : ""}</option>

        {isBeyoglu ? (
          <option value="READY_FOR_PICKUP" disabled={!canTransition(status, "READY_FOR_PICKUP")}>📍 Mağazada Teslime Hazır</option>
        ) : (
          <option value="SHIPPED" disabled={!canTransition(status, "SHIPPED")}>📦 Kargoya Verildi</option>
        )}

        <option value="DELIVERED" disabled={!canTransition(status, "DELIVERED")}>✓ Teslim Edildi</option>
        <option value="CANCELLED" disabled={!canTransition(status, "CANCELLED")}>✕ İptal Edildi</option>
        <option value="RETURNED" disabled={!canTransition(status, "RETURNED")}>↩ İade Edildi</option>
      </select>

      {loading && <span className="text-[10px] text-ink-subtle animate-spin">⌛</span>}
    </div>
  );
}