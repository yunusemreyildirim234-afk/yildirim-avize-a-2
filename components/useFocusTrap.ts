"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface FocusTrapOptions {
  /** Escape tuşuna basılınca (kapatma). Yeniden çizimde dinleyici/odak sıfırlanmaz. */
  onEscape: () => void;
  /** Açılışta odaklanacak öğe; verilmezse kapsayıcıdaki ilk odaklanabilir öğe; `"none"` ise odak taşınmaz. */
  initialFocus?: RefObject<HTMLElement | null> | "none";
}

/**
 * Modal/çekmece odak yönetimi: açılışta odağı içeri alır, Tab/Shift+Tab kapsayıcı içinde döner, Escape kapatır, kapanınca odağı tetikleyene geri verir.
 * `active` false iken hiçbir şey yapmaz. Escape olayı üst katmanlara iletilmez (iç içe pencerede yalnız en üsttekini kapatır).
 */
export function useFocusTrap(active: boolean, container: RefObject<HTMLElement | null>, { onEscape, initialFocus }: FocusTrapOptions) {
  const escapeFn = useRef(onEscape);
  const initialRef = useRef(initialFocus);
  // Son değerler her çizimden sonra ref'e yazılır (aşağıdaki efektten ÖNCE çalışır); pencere yeniden çizilince odak/dinleyici sıfırlanmaz
  useEffect(() => {
    escapeFn.current = onEscape;
    initialRef.current = initialFocus;
  });

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const items = () => Array.from(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const init = initialRef.current;
    if (init !== "none") (init?.current ?? items()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        escapeFn.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const cur = document.activeElement;
      const inside = container.current?.contains(cur) ?? false;
      if (e.shiftKey && (cur === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (cur === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [active, container]);
}
