"use client";

import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

/** Havale siparişi için "Havale Bildirimi Yap / Dekont Yükle" butonu ve formu. */
export default function ReceiptUpload({
  orderId,
  uploaded,
  defaultSender = "",
  onDone,
}: {
  orderId: string;
  uploaded: boolean;
  defaultSender?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(uploaded);
  const [sender, setSender] = useState(defaultSender);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (done && !open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-900">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <CheckCircle2 aria-hidden="true" className="w-4 h-4" /> Dekontunuz iletildi, ödemeniz kontrol ediliyor.
        </span>
        <button type="button" onClick={() => setOpen(true)} className="underline font-semibold">
          Yeniden yükle
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-3 transition-colors shadow-sm"
      >
        <Upload aria-hidden="true" className="w-4 h-4" /> Havale Bildirimi Yap / Dekont Yükle
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("senderName", sender);
      fd.set("file", file);
      const res = await fetch("/api/orders/receipt", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dekont yüklenemedi.");
      toast.success("Dekontunuz iletildi", { description: "Ödemeniz kontrol edilip siparişiniz onaylanacaktır." });
      setDone(true);
      setOpen(false);
      onDone?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-left text-xs">
      <p className="font-bold text-emerald-950">Havale Bildirimi</p>
      <div>
        <label className="font-semibold text-neutral-700 block mb-1">Gönderici Ad-Soyadı</label>
        <input
          required
          minLength={3}
          maxLength={120}
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="Havaleyi yapan kişinin adı soyadı"
          className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-emerald-600"
        />
      </div>
      <div>
        <label className="font-semibold text-neutral-700 block mb-1">Dekont Dosyası (Görsel veya PDF, en çok 4 MB)</label>
        <input
          required
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white file:px-3 file:py-2 file:font-semibold"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !file} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl">
          {busy ? "Yükleniyor..." : "Gönder"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-neutral-500 font-semibold px-3 py-2.5">
          Vazgeç
        </button>
      </div>
    </form>
  );
}
