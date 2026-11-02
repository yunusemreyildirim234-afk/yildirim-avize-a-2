"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CompanyInfo } from "@/lib/company";
import { compressImageToWebP, MAX_RAW_BYTES } from "@/lib/client-image";

type TextKey = "companyTitle" | "taxOffice" | "taxNumber" | "mersisNo" | "kepAddress" | "headquartersAddress" | "etbisUrl";

const FIELDS: { key: TextKey; label: string; wide?: boolean }[] = [
  { key: "companyTitle", label: "Unvan" },
  { key: "taxOffice", label: "Vergi Dairesi" },
  { key: "taxNumber", label: "Vergi / TC Kimlik No" },
  { key: "mersisNo", label: "MERSİS No" },
  { key: "kepAddress", label: "KEP Adresi" },
  { key: "headquartersAddress", label: "Merkez Adresi", wide: true },
  { key: "etbisUrl", label: "ETBİS Bağlantısı", wide: true },
];

const MAX_QR_BYTES = 1024 * 1024;

export default function AdminCompany({ initial }: { initial: CompanyInfo }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, etbisUrl: initial.etbisUrl ?? "", etbisQrImage: initial.etbisQrImage ?? "" });
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const onFile = async (picked: File | undefined) => {
    if (!picked) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(picked.type)) return toast.error("Yalnızca PNG, JPEG veya WebP yüklenebilir.");
    if (picked.size > MAX_RAW_BYTES) return toast.error("Dosya en fazla 20 MB olabilir.");
    setOptimizing(true);
    const file = await compressImageToWebP(picked, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
    setOptimizing(false);
    if (file.size > MAX_QR_BYTES) return toast.error("Karekod görseli küçültüldükten sonra bile 1 MB'dan büyük.");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, etbisQrImage: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.");
      toast.success("Kurumsal bilgiler güncellendi");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full p-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-amber-600";
  const isUploaded = form.etbisQrImage.startsWith("data:");

  return (
    <form onSubmit={save} className="p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className={`block text-xs font-semibold text-neutral-700 ${f.wide ? "sm:col-span-2" : ""}`}>
            {f.label}
            <input
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              required={f.key !== "etbisUrl"}
              maxLength={300}
              className={`${input} mt-1 font-normal`}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-semibold text-neutral-700">ETBİS Karekod Görseli (dosya yükleyin veya bağlantı girin)</span>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {form.etbisQrImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.etbisQrImage} alt="ETBİS karekod önizleme" className="h-24 w-24 rounded-lg border border-neutral-200 object-contain bg-white p-1" />
          )}
          <div className="flex-1 space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-neutral-800 hover:file:bg-neutral-200"
            />
            {optimizing && <p className="text-[11px] text-amber-700">Görsel optimize ediliyor...</p>}
            <input
              value={isUploaded ? "" : form.etbisQrImage}
              onChange={(e) => setForm((s) => ({ ...s, etbisQrImage: e.target.value }))}
              placeholder={isUploaded ? "(Yüklenen dosya kullanılıyor)" : "https://... görsel bağlantısı"}
              className={input}
            />
          </div>
          {form.etbisQrImage && (
            <button type="button" onClick={() => setForm((s) => ({ ...s, etbisQrImage: "" }))} className="text-xs text-red-600 hover:underline w-fit">
              Görseli kaldır
            </button>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || optimizing}
        className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
