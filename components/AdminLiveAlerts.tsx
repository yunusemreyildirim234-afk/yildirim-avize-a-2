"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Payload {
  orders: { id: string; total: number; customer: string }[];
  messages: { id: string; name: string; topic: string }[];
}

const POLL_MS = 30_000;

/** Yönetim paneli açıkken yeni sipariş veya soru düşünce kayan uyarı gösterir. */
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
        let fresh = false;
        for (const o of data.orders) {
          if (seen.current.has(`o:${o.id}`)) continue;
          fresh = true;
          toast.success(`Yeni Sipariş: #${o.id.slice(0, 8)}`, {
            description: `${o.customer} • ${o.total.toLocaleString("tr-TR")} ₺`,
            duration: 15000,
          });
        }
        for (const m of data.messages) {
          if (seen.current.has(`m:${m.id}`)) continue;
          fresh = true;
          toast.info(`Yeni Soru/Mesaj: ${m.topic}`, { description: m.name, duration: 15000 });
        }
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
