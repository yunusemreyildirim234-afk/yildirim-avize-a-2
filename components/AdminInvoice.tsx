"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InvoiceMeta } from "@/lib/invoice";

interface Props {
  orderId: string;
  /** "ok": tablo hazır; "missing": OrderInvoice tablosu henüz oluşturulmamış; "error": fatura bilgisi okunamadı */
  state: "ok" | "missing" | "error";
  meta: InvoiceMeta | null;
}

const MAX_BYTES = 3 * 1024 * 1024;
const btn = "text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";

/** Teslim edilmiş siparişin PDF faturası: yükle, değiştir, sil, e-postayı yeniden gönder. */
export default function AdminInvoice({ orderId, state, meta }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | "mail" | null>(null);
  const url = `/api/admin/orders/${orderId}/invoice`;

  if (state === "missing") {
    return <p className="mt-2 text-[11px] text-neutral-500 border border-dashed border-neutral-300 rounded-lg px-3 py-2">Fatura özelliği için veritabanı güncellemesi bekleniyor.</p>;
  }
  if (state === "error") {
    return <p className="mt-2 text-[11px] text-red-700 border border-red-200 bg-red-50 rounded-lg px-3 py-2">Fatura bilgisi şu anda okunamadı. Sayfayı yenileyip tekrar deneyin.</p>;
  }

  const call = async (kind: "upload" | "delete" | "mail", init: RequestInit, okMsg: (d: { emailed?: boolean }) => string) => {
    if (busy) return;
    setBusy(kind);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success(okMsg(data));
      if (kind === "upload" && data.emailed === false) toast.warning("Fatura kaydedildi ancak e-posta gönderilemedi. \"E-postayı yeniden gönder\" ile tekrar deneyin.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Bağlantı hatası oluştu.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Yalnızca PDF yüklenebilir.");
    if (file.size > MAX_BYTES) return toast.error("Fatura en fazla 3 MB olabilir.");
    if (meta && !window.confirm("Mevcut fatura değiştirilecek ve müşteriye yeni fatura e-postayla gönderilecek. Devam edilsin mi?")) return;
    const form = new FormData();
    form.append("file", file);
    call("upload", { method: "POST", body: form }, (d) => (d.emailed ? "Fatura yüklendi ve müşteriye e-postayla gönderildi" : "Fatura yüklendi"));
  };

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-2 max-w-xs">
      <p className="text-[11px] font-bold text-neutral-800">🧾 Fatura</p>
      <input ref={input} type="file" accept="application/pdf" aria-label="Fatura PDF dosyası" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />

      {meta ? (
        <>
          <p className="text-[11px] text-neutral-600 break-words">
            {meta.fileName} • {(meta.size / 1024).toFixed(0)} KB
            <span className="block text-neutral-400">Yüklenme: {new Date(meta.uploadedAt).toLocaleString("tr-TR")}</span>
          </p>
          <p className={`text-[11px] font-semibold ${meta.emailSentAt ? "text-emerald-700" : "text-red-700"}`}>
            {meta.emailSentAt ? `✓ E-posta gönderildi (${new Date(meta.emailSentAt).toLocaleString("tr-TR")})` : "E-posta gönderilemedi, yeniden deneyin"}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={url} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100`}>İndir</a>
            <button type="button" disabled={busy !== null} onClick={() => call("mail", { method: "PATCH" }, () => "Fatura e-postayla yeniden gönderildi")} className={`${btn} ${meta.emailSentAt ? "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "bg-amber-600 border-amber-600 text-white hover:bg-amber-700"}`}>
              {busy === "mail" ? "Gönderiliyor..." : "E-postayı yeniden gönder"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={`${btn} bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100`}>
              {busy === "upload" ? "Yükleniyor..." : "Değiştir"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => window.confirm("Fatura silinsin mi? Müşteriye daha önce gönderilen e-posta geri alınmaz.") && call("delete", { method: "DELETE" }, () => "Fatura silindi")}
              className={`${btn} bg-white border-red-300 text-red-700 hover:bg-red-50`}
            >
              {busy === "delete" ? "Siliniyor..." : "Sil"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-neutral-500">Henüz fatura yüklenmedi. Yüklediğiniz PDF müşteriye e-postayla ek olarak gönderilir.</p>
          <button type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={`${btn} bg-neutral-900 border-neutral-900 text-white hover:bg-amber-600 hover:border-amber-600`}>
            {busy === "upload" ? "Yükleniyor ve gönderiliyor..." : "Fatura PDF'i yükle"}
          </button>
        </>
      )}
    </div>
  );
}
