"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hrefFromTestId, resolveLinkAction } from "@/lib/toast-link";

/** Aynı sayfadaki hash bağlantısı: hashchange tetikler (AdminSection paneli açıp kaydırır); hash zaten aynıysa olayı elle gönderir. */
export function goToHash(hash: string) {
  const same = window.location.hash === `#${hash}`;
  window.location.hash = hash;
  if (same) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * `toastHref("/yol")` ile açılan sonner toast'larını tıklanabilir yapar (görünüm değişmez).
 * Geri Al / kapat (×) / eylem düğmeleri yönlendirmez. Enter/Space ile de çalışır; zaten o sayfadaysa yönlendirmez.
 */
export default function ToastLinkRouter() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const toastOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-sonner-toast]") : null);
    const go = (li: HTMLElement) => {
      const href = hrefFromTestId(li.getAttribute("data-testid"));
      if (!href) return;
      const a = resolveLinkAction(pathname, href);
      if (a.kind === "navigate") router.push(a.href);
      else if (a.kind === "hash") goToHash(a.hash);
    };
    const mark = (e: Event) => {
      const li = toastOf(e.target);
      if (li && hrefFromTestId(li.getAttribute("data-testid")) && !li.hasAttribute("role")) li.setAttribute("role", "link");
    };
    const onClick = (e: MouseEvent) => {
      const li = toastOf(e.target);
      if (!li || (e.target as Element).closest("button")) return; // Geri Al, ×, eylem düğmeleri
      go(li);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const li = toastOf(e.target);
      if (!li || e.target !== li) return; // düğmeler kendi davranışını korur
      if (!hrefFromTestId(li.getAttribute("data-testid"))) return;
      e.preventDefault();
      go(li);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", mark);
    document.addEventListener("pointerover", mark);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", mark);
      document.removeEventListener("pointerover", mark);
    };
  }, [router, pathname]);

  return null;
}
