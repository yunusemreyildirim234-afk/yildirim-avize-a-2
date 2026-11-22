"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSectionOpen } from "@/components/SectionOpen";

/** Yönetici bölüm listesi: bölüm ilk açıldığında endpoint'ten çekilir (AdminActivity kalıbı); load() listeyi yeniden okur. */
export function useAdminList<T>(endpoint: string) {
  const open = useSectionOpen();
  const started = useRef(false);
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetch(endpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((d: T) => setData(d))
      .catch(() => setFailed(true));
  }, [endpoint]);

  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      load();
    }
  }, [open, load]);

  return { open, data, failed, load };
}

/** Yükleniyor / hata görünümü (veri gelene kadar). */
export function AdminListStatus({ open, failed, load, what }: { open: boolean; failed: boolean; load: () => void; what: string }) {
  return failed ? (
    <p className="p-10 text-center text-xs text-neutral-500">
      {what} okunamadı.{" "}
      <button type="button" onClick={load} className="font-semibold underline hover:text-amber-700">Yeniden dene</button>
    </p>
  ) : (
    <p role="status" className="p-10 text-center text-xs text-neutral-400">{open ? "Yükleniyor…" : "Bölümü açınca yüklenir."}</p>
  );
}
