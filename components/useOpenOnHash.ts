"use client";

import { useEffect } from "react";

/** /admin#<id> bağlantısı (ör. "bölüme git" çubuğu) bölümü açar ve ekrana getirir; hash aynı kalsa da çubuk "hashchange" olayını yeniden tetikler. */
export function useOpenOnHash(id: string, setOpen: (open: boolean) => void) {
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id, setOpen]);
}
