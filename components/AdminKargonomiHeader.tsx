"use client";

import { useEffect, useState } from "react";

interface Status {
  connected: boolean;
  shipmentCount?: number;
  warehouse?: string | null;
  error?: string;
}

export default function AdminKargonomiHeader() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/kargonomi")
      .then((res) => res.json())
      .then((data: Status) => active && setStatus(data))
      .catch(() => active && setStatus({ connected: false, error: "Sunucuya ulaşılamadı." }));
    return () => {
      active = false;
    };
  }, [tick]);

  const refresh = () => {
    setStatus(null);
    setTick((t) => t + 1);
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
        status === null
          ? "bg-white border-neutral-200"
          : status.connected
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
            status === null ? "bg-neutral-300 animate-pulse" : status.connected ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <div>
          <h2 className="text-sm font-bold text-neutral-900">Kargonomi API v1</h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            {status === null && "Bağlantı kontrol ediliyor..."}
            {status?.connected &&
              `Bağlantı aktif • ${status.shipmentCount ?? 0} gönderi${status.warehouse ? ` • Depo: ${status.warehouse}` : ""}`}
            {status && !status.connected && `Bağlantı kurulamadı: ${status.error ?? "bilinmeyen hata"}`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        aria-label="Kargonomi bağlantısını yeniden kontrol et"
        className="text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-xl hover:bg-neutral-50 transition-colors w-fit"
      >
        Yeniden Kontrol Et
      </button>
    </div>
  );
}
