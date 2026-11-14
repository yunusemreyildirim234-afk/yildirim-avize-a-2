"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, Undo2 } from "lucide-react";
import { DELETE_CONFIRM_WORD, isDeleteConfirmed } from "@/lib/bulk-delete";
import ConfirmDialog from "@/components/ConfirmDialog";

const DELAY_MS = 8000;
let pending = 0; // aynı anda bekleyen silme çubuklarını alt alta dizmek için

/**
 * Sayfa içi onay penceresi ("Emin misiniz?"; toplu silmede SİL yazdırır) + gecikmeli kesin silme: onaydan sonra kayıt gizlenir, 8 saniye boyunca "↩ Geri Al" çubuğu görünür;
 * süre dolunca DELETE gönderilir. Geri Al'a basılırsa (veya sayfadan ayrılırsanız) hiçbir şey silinmez.
 */
export default function AdminDeleteButton({
  endpoint,
  ids = [],
  payload,
  label,
  confirmText,
  className = "",
  disabled = false,
  expectedCount,
  typeToConfirm = false,
  onDone,
}: {
  endpoint: string;
  ids?: string[];
  payload?: Record<string, unknown>;
  label: string;
  confirmText: string;
  className?: string;
  disabled?: boolean;
  /** Çoklu silme: onaylanan sipariş sayısı sunucuya gider; eşleşmezse sunucu reddeder */
  expectedCount?: number;
  /** Onay penceresinde "SİL" yazdırır (toplu silme) */
  typeToConfirm?: boolean;
  /** Silme başarılı olunca (listeyi kendi çeken bileşenler yeniden yüklemek için) */
  onDone?: () => void;
}) {
  const router = useRouter();
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [slot, setSlot] = useState(0);
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const body = payload ?? (expectedCount === undefined ? { ids } : { ids, expectedCount });
  const empty = !payload && ids.length === 0;

  const row = () => (ids.length === 1 || payload ? (btn.current?.closest("[data-undo-row], tr, li") as HTMLElement | null) : null);
  const finish = () => {
    pending = Math.max(0, pending - 1);
    setWaiting(false);
  };

  const ask = () => {
    if (empty) return;
    setTyped("");
    setAsking(true);
  };

  const start = () => {
    if (empty) return;
    // Toplu silme: yazılı onay; yanlış/boş yazı hiçbir şey silmez
    if (typeToConfirm && !isDeleteConfirmed(typed)) return;
    setAsking(false);
    setSlot(pending++);
    setWaiting(true);
    const el = row();
    if (el) el.style.display = "none";
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Silinemedi.");
        router.refresh();
        onDone?.();
        // Liste yenilendikten sonra satır hâlâ varsa (ör. hareketi silinen üye) yeniden gösterilir
        setTimeout(() => {
          if (el?.isConnected) el.style.display = "";
        }, 2000);
      } catch (e) {
        if (el) el.style.display = "";
        alert((e as Error).message);
      } finally {
        finish();
      }
    }, DELAY_MS);
  };

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    const el = row();
    if (el) el.style.display = "";
    finish();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={ask}
        disabled={waiting || disabled || empty}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-600 ${className}`}
      >
        <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> {waiting ? "Siliniyor..." : label}
      </button>
      <ConfirmDialog
        open={asking}
        title={typeToConfirm ? "Toplu silme onayı" : "Silinsin mi?"}
        confirmLabel="Evet, sil"
        danger
        confirmDisabled={typeToConfirm && !isDeleteConfirmed(typed)}
        onConfirm={start}
        onCancel={() => setAsking(false)}
      >
        <p className="whitespace-pre-line font-semibold text-neutral-900">{confirmText}</p>
        <p>
          Silme {DELAY_MS / 1000} saniye sonra uygulanır; bu sürede alttaki çubuktan &quot;Geri Al&quot; diyebilirsiniz. Süre dolunca kayıt kalıcı olarak silinir ve geri alınamaz.
        </p>
        {typeToConfirm && (
          <label className="block font-semibold text-neutral-900">
            Onaylamak için {DELETE_CONFIRM_WORD} yazın
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isDeleteConfirmed(typed) && start()}
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-red-600"
            />
          </label>
        )}
      </ConfirmDialog>
      {waiting &&
        createPortal(
        <div role="status" style={{ bottom: `${1 + slot * 3.25}rem` }} className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-neutral-900 text-white text-xs pl-5 pr-2 py-2 shadow-2xl">
          <span>Kayıt {DELAY_MS / 1000} sn içinde silinecek.</span>
          <button type="button" onClick={cancel} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5">
            <Undo2 aria-hidden="true" className="w-3.5 h-3.5" /> Geri Al
          </button>
        </div>,
          document.body
        )}
    </>
  );
}
