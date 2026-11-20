"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/components/useFocusTrap";

/**
 * Sayfa içi onay penceresi (tarayıcının confirm/prompt kutusu yerine). Escape ve "Vazgeç" kapatır; ilk odak güvenli seçenekte (Vazgeç).
 * Gövdeye taşınır: satır gizlense ya da menü kapansa da pencere görünür kalır.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Vazgeç",
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, boxRef, { onEscape: onCancel, initialFocus: cancelRef }); // Esc, Tab döngüsü, ilk odak Vazgeç, kapanınca odak tetikleyiciye

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="w-full max-w-md rounded-xl border border-line bg-raised p-5 shadow-2xl">
        <h2 id={`${id}-t`} className="text-sm font-bold text-ink">{title}</h2>
        <div id={`${id}-d`} className="mt-2 space-y-2 text-xs leading-relaxed text-ink-muted">{children}</div>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} className="inline-flex min-h-10 items-center rounded-lg border border-line-strong bg-raised px-4 text-xs font-semibold text-ink hover:border-bronze-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink">
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className={`inline-flex min-h-10 items-center rounded-lg px-4 text-xs font-bold text-canvas disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink ${danger ? "bg-red-700 hover:bg-red-800" : "bg-ink hover:bg-bronze-ink"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
