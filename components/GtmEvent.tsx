"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GTM_ID, gtmPush } from "@/lib/gtm";
import type { GtmEventPayload } from "@/lib/gtm-events";

/** Sayfa açılışında bir dataLayer olayı gönderir. onceKey verilirse (purchase) bu tarayıcıda anahtar başına yalnızca bir kez. */
export function GtmEvent({ event, onceKey }: { event: GtmEventPayload; onceKey?: string }) {
  const json = JSON.stringify(event);
  useEffect(() => {
    if (onceKey) {
      try {
        if (localStorage.getItem(onceKey)) return;
      } catch {
        return; // tekrar ateşlemeyi engelleyemeyiz: gönderme
      }
    }
    if (!gtmPush(JSON.parse(json) as GtmEventPayload)) return;
    if (onceKey) {
      try {
        localStorage.setItem(onceKey, "1");
      } catch {
        /* depolama kapalı */
      }
    }
  }, [json, onceKey]);
  return null;
}

/** Kartlı ödeme onayı bankadan gecikirse (AWAITING_PAYMENT) sayfa birkaç kez sessizce yenilenir; yalnızca GTM tanımlıysa. */
export function GtmAwaitPayment() {
  const router = useRouter();
  useEffect(() => {
    if (!GTM_ID) return;
    let n = 0;
    const t = window.setInterval(() => {
      if (++n > 8) window.clearInterval(t);
      else router.refresh();
    }, 4000);
    return () => window.clearInterval(t);
  }, [router]);
  return null;
}
