"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { subscribeSummary } from "@/lib/notification-poll";
import { summaryChanged, type NotificationSummary } from "@/lib/notification-summary";

/** Yönetim paneli açıkken yeni sipariş/soru düşünce listeleri yeniler (kayan uyarıyı bildirim zili gösterir). Zil ile AYNI özet isteğini paylaşır (tek yoklama, 180 sn, gizli sekmede durur). */
export default function AdminLiveAlerts() {
  const router = useRouter();
  const known = useRef<NotificationSummary | null>(null);

  useEffect(() => {
    return subscribeSummary(
      "/api/notifications?scope=admin&ozet=1",
      (s) => {
        const prev = known.current;
        known.current = s;
        if (prev && summaryChanged(prev, s).newItems) router.refresh();
      },
      180_000
    );
  }, [router]);

  return null;
}
