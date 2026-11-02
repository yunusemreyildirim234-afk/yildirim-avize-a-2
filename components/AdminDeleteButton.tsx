"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Onay penceresi ("Emin misiniz?") ile tekil/toplu silme. ids seçilen kayıtların kimlikleridir. */
export default function AdminDeleteButton({
  endpoint,
  ids,
  label,
  confirmText,
  className = "",
}: {
  endpoint: string;
  ids: string[];
  label: string;
  confirmText: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (ids.length === 0 || !confirm(`Emin misiniz? ${confirmText}\n\nBu işlem geri alınamaz.`)) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Silinemedi.");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || ids.length === 0}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-600 ${className}`}
    >
      <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> {busy ? "Siliniyor..." : label}
    </button>
  );
}
