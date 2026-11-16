"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import BankLogo from "@/components/BankLogo";
import { formatRate, INSTALLMENT_BANKS, INSTALLMENT_COUNTS } from "@/lib/installments";

function Dialog({ onClose }: { onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, boxRef, { onEscape: onClose });
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="taksit-baslik" className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button type="button" tabIndex={-1} aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-zinc-950/60" />
      <div ref={boxRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <h2 id="taksit-baslik" className="text-base font-serif font-bold text-neutral-900">Taksit Seçenekleri</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-1.5 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-amber-600">
            <X aria-hidden="true" className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
        <div className="overflow-y-auto px-3 sm:px-5 py-4 text-xs text-neutral-700">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Taksit oranları tablosu">
            <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
              <caption className="sr-only">Bankalara göre taksit sayısı ve komisyon oranı</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-600">
                  <th scope="col" className="py-2 pr-2 font-semibold">Kart</th>
                  {INSTALLMENT_COUNTS.map((n) => (
                    <th key={n} scope="col" className="py-2 px-1 sm:px-2 font-semibold text-center leading-tight">
                      <span className="block text-neutral-900">{n}</span>
                      <span className="block font-normal">taksit</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INSTALLMENT_BANKS.map((b) => (
                  <tr key={b.id} className="border-b border-neutral-100">
                    <th scope="row" className="py-1.5 pr-2 font-semibold text-neutral-900">
                      <BankLogo id={b.id} fallbackName={b.name} imgClassName="max-w-[76px] sm:max-w-[110px]" />
                      <span className="sr-only">{b.name}</span>
                    </th>
                    {INSTALLMENT_COUNTS.map((n) => (
                      <td key={n} className="py-1.5 px-1 sm:px-2 text-center tabular-nums whitespace-nowrap text-neutral-900">{formatRate(b.rates[n])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-neutral-600">Tablodaki oranlar taksit sayısına göre komisyon yüzdesidir.</p>
          <p className="mt-1 font-semibold text-neutral-900">Kesin tutar ödeme adımında kartınıza göre gösterilir.</p>
        </div>
      </div>
    </div>
  );
}

/** "Taksit seçeneklerini gör" bağlantısı + oran tablosu penceresi. Hesap yapmaz; yalnızca oranları gösterir. */
export default function InstallmentLink({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-amber-600 ${className}`}
      >
        Taksit seçeneklerini gör
      </button>
      {open && <Dialog onClose={() => setOpen(false)} />}
    </>
  );
}
