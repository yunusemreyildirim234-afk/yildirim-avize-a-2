"use client";

import { Printer } from "lucide-react";

/** Tarayıcının yazdırma penceresini açar; sayfadaki sade fiş yalnızca yazdırmada görünür (print: sınıfları). */
export default function AdminPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-amber-600"
    >
      <Printer aria-hidden="true" className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
