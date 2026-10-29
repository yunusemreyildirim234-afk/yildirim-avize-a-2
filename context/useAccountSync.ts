"use client";

import { useEffect, useState } from "react";

interface Options<T> {
  /** GET (401 = oturum yok) ve PUT için API yolu */
  endpoint: string;
  list: T[];
  setList: (updater: (prev: T[]) => T[]) => void;
  /** Girişten hemen sonra yerel (misafir) liste ile hesap listesini birleştirir */
  merge: (local: T[], remote: T[]) => T[];
  serialize: (list: T[]) => unknown;
  /** Yerel depolama okunduktan sonra true */
  ready: boolean;
}

/**
 * Giriş yapmış müşterinin listesini veritabanıyla eşitler:
 * - Girişte misafir listesi hesaba birleştirilir, sonraki açılışlarda hesap listesi esas alınır.
 * - Değişiklikler kısa bir gecikmeyle hesaba kaydedilir.
 * - Çıkışta (veya oturum bitince) yerel liste temizlenir.
 */
export function useAccountSync<T>({ endpoint, list, setList, merge, serialize, ready }: Options<T>) {
  const [synced, setSynced] = useState(false);
  const flagKey = `ya_sync_${endpoint}`;

  useEffect(() => {
    if (!ready) return;
    let active = true;

    const probe = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!active) return;
        if (res.status === 401) {
          setSynced(false);
          if (localStorage.getItem(flagKey)) {
            localStorage.removeItem(flagKey);
            setList(() => []);
          }
          return;
        }
        if (!res.ok) return;
        const remote: T[] = (await res.json()).items ?? [];
        if (!active) return;
        const returning = Boolean(localStorage.getItem(flagKey));
        localStorage.setItem(flagKey, "1");
        setList((prev) => (returning ? remote : merge(prev, remote)));
        setSynced(true);
      } catch {
        // ağ/depolama hatası: yerel liste çalışmaya devam eder
      }
    };

    probe();
    window.addEventListener("ya-auth", probe);
    return () => {
      active = false;
      window.removeEventListener("ya-auth", probe);
    };
  }, [ready, endpoint, flagKey, setList, merge]);

  useEffect(() => {
    if (!synced) return;
    const timer = setTimeout(() => {
      fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: serialize(list) }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [synced, list, endpoint, serialize]);
}
