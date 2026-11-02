"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CompanyInfo } from "@/lib/company";

type TextKey = "companyTitle" | "taxOffice" | "taxNumber" | "mersisNo" | "kepAddress" | "headquartersAddress" | "etbisUrl";

const FIELDS: { key: TextKey; label: string; wide?: boolean }[] = [
  { key: "companyTitle", label: "Unvan" },
  { key: "taxOffice", label: "Vergi Dairesi" },
  { key: "taxNumber", label: "Vergi / TC Kimlik No" },
  { key: "mersisNo", label: "MERSİS No" },
  { key: "kepAddress", label: "KEP Adresi" },
  { key: "headquartersAddress", label: "Merkez Adresi", wide: true },
  { key: "etbisUrl", label: "ETBİS Site Sorgulama Bağlantısı (https://...)", wide: true },
];

export default function AdminCompany({ initial }: { initial: CompanyInfo }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, etbisUrl: initial.etbisUrl ?? "" });
  const [saving, setSaving] = useState(false);

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

      <button
        type="submit"
        disabled={saving}
        className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
