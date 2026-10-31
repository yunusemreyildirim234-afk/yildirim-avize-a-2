"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Payload {
  orders: { id: string; total: number; customer: string }[];
  messages: { id: string; name: string; topic: string }[];
}

const POLL_MS = 30_000;

/** Yönetim paneli açıkken yeni sipariş/soru düşünce listeleri yeniler (kayan uyarıyı bildirim zili gösterir). */
export default function AdminLiveAlerts() {
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data: Payload = await res.json();
        const keys = [...data.orders.map((o) => `o:${o.id}`), ...data.messages.map((m) => `m:${m.id}`)];

        // İlk yükleme: mevcutlar sessizce kaydedilir
        if (seen.current === null) {
          seen.current = new Set(keys);
          return;
        }
        const fresh = keys.some((k) => !seen.current?.has(k));
        keys.forEach((k) => seen.current?.add(k));
        if (fresh) router.refresh();
      } catch {
        /* ağ hatası: bir sonraki turda yeniden denenir */
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
