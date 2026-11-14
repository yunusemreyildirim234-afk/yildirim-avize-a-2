"use client";

import { useEffect } from "react";
import { gtmPush } from "@/lib/gtm";
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
