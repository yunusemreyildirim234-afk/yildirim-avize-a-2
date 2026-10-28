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
      className="fixed bottom-0 inset-x-0 z-[60] bg-neutral-900 text-neutral-200 border-t border-neutral-700 px-4 py-3 sm:py-4"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs">
        <p className="flex-1 leading-relaxed text-neutral-300">
          Sitemizde deneyiminizi iyileştirmek için zorunlu çerezler kullanılır. Kişisel verileriniz 6698 sayılı KVKK
          kapsamında işlenir; ayrıntılar için{" "}
          <Link href="/gizlilik-politikasi" className="text-amber-400 underline underline-offset-2">
            Gizlilik Politikası
          </Link>
          &apos;nı inceleyebilirsiniz.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => answer("rejected")}
            className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors font-medium"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => answer("accepted")}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold transition-colors"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
