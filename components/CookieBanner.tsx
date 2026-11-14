"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const KEY = "ya-cerez-onayi";

const subscribe = () => () => {};
const readConsent = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "storage-unavailable";
  }
};

export default function CookieBanner() {
  const stored = useSyncExternalStore(subscribe, readConsent, () => "ssr");
  const [dismissed, setDismissed] = useState(false);

  if (stored !== null || dismissed) return null;

  const answer = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // depolama kapalıysa yalnızca bu oturumda gizle
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Çerez ve KVKK bilgilendirmesi"
      className="fixed bottom-3 left-3 right-24 sm:right-auto sm:bottom-6 sm:left-6 sm:max-w-md z-[55] rounded-2xl bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl p-4"
    >
      <p className="text-xs leading-relaxed text-zinc-300">
        Sitemizin çalışması için zorunlu çerezler kullanırız. &apos;Kabul Et&apos;e basarsanız ayrıca ziyaretinizi ölçmek (Google Analytics) ve reklam performansını değerlendirmek için Google çerezleri de açılır. &apos;Reddet&apos;e basarsanız yalnız zorunlu çerezler kullanılır. Ayrıntılar için{" "}
        <Link href="/cerez-politikasi" className="text-amber-400 underline underline-offset-2">
          Çerez Politikası
        </Link>
        &apos;na bakın.
      </p>
      <div className="flex items-center gap-2 mt-3 text-xs">
        <button
          type="button"
          onClick={() => answer("accepted")}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors"
        >
          Kabul Et
        </button>
        <button
          type="button"
          onClick={() => answer("rejected")}
          className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors font-medium"
        >
          Reddet
        </button>
      </div>
    </div>
  );
}
