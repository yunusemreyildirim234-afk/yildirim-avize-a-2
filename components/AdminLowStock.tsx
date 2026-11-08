"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { MAX_LOW_STOCK, MIN_LOW_STOCK, validThreshold, type LowStockSetting } from "@/lib/low-stock";

// "Stok azaldı rozeti": açıkken stoğu 1..eşik olan ürünlerde vitrinde "Son N adet" görünür. Varsayılan KAPALI.
export default function AdminLowStock({ initial }: { initial: LowStockSetting }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [threshold, setThreshold] = useState(String(initial.threshold));
  const [saving, setSaving] = useState(false);
  const parsed = validThreshold(Number(threshold));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed === null) return toast.error(`Eşik ${MIN_LOW_STOCK} ile ${MAX_LOW_STOCK} arasında tam sayı olmalıdır.`);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lowStock", key: "*", enabled, threshold: parsed }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.");
      toast.success("Stok azaldı rozeti ayarı güncellendi");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="stok-rozeti" data-testid="stok-rozeti-form" onSubmit={save} className="scroll-mt-[var(--admin-offset,6rem)] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-wrap items-end gap-3">
      <div className="basis-full">
        <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2"><Boxes aria-hidden="true" className="w-4 h-4 text-amber-600" /> Stok Azaldı Rozeti</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Yalnızca gerçek stok eşiğin altındaysa görünür. Trendyol ile stok ortak olduğu için eşitleme gecikmesi olabilir.
        </p>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-neutral-800 cursor-pointer">
        <input type="checkbox" data-testid="stok-rozeti-acik" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5 accent-amber-600" />
        &ldquo;Son N adet&rdquo; rozetini göster
      </label>
      <label className="text-xs font-semibold text-neutral-700">
        Eşik (adet)
        <input data-testid="stok-rozeti-esik" type="number" inputMode="numeric" min={MIN_LOW_STOCK} max={MAX_LOW_STOCK} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-invalid={parsed === null} className="block mt-1 w-24 min-h-10 p-2.5 rounded-xl border border-neutral-300 text-sm font-normal focus:outline-none focus:border-amber-600 aria-invalid:border-red-500" />
      </label>
      <button type="submit" disabled={saving} className="min-h-10 bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
      {parsed === null && <p role="alert" className="basis-full text-xs font-semibold text-red-700">Eşik {MIN_LOW_STOCK} ile {MAX_LOW_STOCK} arasında tam sayı olmalıdır.</p>}
    </form>
  );
}
