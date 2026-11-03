"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { GTM_ID, applyConsent, initConsent, readConsent, revokeForAdmin } from "@/lib/gtm";
import { isAdminPath } from "@/lib/gtm-events";

/**
 * Google Tag Manager yükleyici. NEXT_PUBLIC_GTM_ID yoksa hiçbir şey yapmaz; /admin altında hiçbir şey yüklemez.
 * Consent Mode v2 varsayılanı "denied"; GTM yalnızca çerez çubuğunda "Kabul Et" seçildiyse yüklenir ve izinler "granted" olur.
 * Çubuk değişiklik olayı yayınlamadığından aynı sekmedeki karar kısa aralıkla okunur; diğer sekmeler için "storage" olayı dinlenir.
 */
export default function GoogleTagManager() {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  useEffect(() => {
    if (!GTM_ID) return;
    if (admin) {
      revokeForAdmin();
      return;
    }
    initConsent();
    applyConsent(readConsent());
    const onStorage = () => applyConsent(readConsent());
    window.addEventListener("storage", onStorage);
    // Karar henüz yoksa (çubuk açık) aynı sekmedeki seçimi yakala; karar verilince durur
    let timer: number | undefined;
    if (readConsent() === null) {
      timer = window.setInterval(() => {
        const c = readConsent();
        if (c !== null) {
          applyConsent(c);
          window.clearInterval(timer);
        }
      }, 1000);
    }
    return () => {
      window.removeEventListener("storage", onStorage);
      if (timer) window.clearInterval(timer);
    };
  }, [admin]);

  return null;
}
