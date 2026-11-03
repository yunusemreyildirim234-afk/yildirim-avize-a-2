"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminDiscountSettings({ initial }: { initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxTotalDiscountPct: value.trim() === "" ? null : Number(value.replace(",", ".")) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.");
      toast.success("Genel indirim ayarı güncellendi");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-wrap items-end gap-3">
      <div className="basis-full">
        <h3 className="font-bold text-neutral-900 text-sm">Genel İndirim Ayarları</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Bir üründe adet indirimi + kupon + mağazadan teslim + Havale indirimlerinin toplamı bu yüzdeyi aşmaz. Adet indirimi kısılmaz; kalan pay diğer indirimlere göre verilir. Boş = sınırsız. Yalnızca yeni siparişleri etkiler.
        </p>
      </div>
      <label className="text-xs font-semibold text-neutral-700">
        Maksimum toplam indirim %
        <input type="number" min={0} max={99.99} step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="sınırsız" className="block mt-1 w-32 p-2.5 rounded-xl border border-neutral-300 text-sm font-normal focus:outline-none focus:border-amber-600" />
      </label>
      <button type="submit" disabled={saving} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
