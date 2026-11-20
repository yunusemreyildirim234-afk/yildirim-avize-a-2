"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/useFocusTrap";
import BankLogo from "@/components/BankLogo";
import {
  calculateBankInstallment,
  formatRate,
  formatTl,
  INSTALLMENT_BANKS,
  INSTALLMENT_COUNTS,
  type InstallmentCount,
} from "@/lib/installments";

function Dialog({ amount, onClose }: { amount?: number; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, boxRef, { onEscape: onClose });

  const [selectedBankId, setSelectedBankId] = useState<string>(INSTALLMENT_BANKS[0].id);
  const [selectedCount, setSelectedCount] = useState<InstallmentCount>(3);

  const selectedBank = INSTALLMENT_BANKS.find((b) => b.id === selectedBankId) ?? INSTALLMENT_BANKS[0];
  const selectedRate = selectedBank.rates[selectedCount];
  const calc = typeof amount === "number" ? calculateBankInstallment(amount, selectedBank.id, selectedCount) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="taksit-baslik" className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6">
      <button type="button" tabIndex={-1} aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-neutral-950/60" />
      <div ref={boxRef} className="relative bg-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 border-b border-line shrink-0">
          <div>
            <h2 id="taksit-baslik" className="text-base font-serif font-bold text-ink">
              Taksit Seçenekleri
            </h2>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Taksit tutarını hesaplamak için tablodan bir oran seçin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full p-1.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-bronze-ink"
          >
            <X aria-hidden="true" className="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        <div className="overflow-y-auto px-2 sm:px-5 py-2.5 sm:py-4 text-xs text-ink-muted">
          <div className="overflow-x-auto" role="region" aria-label="Taksit oranları tablosu">
            <table className="w-full border-collapse text-left text-[10.5px] sm:text-xs">
              <caption className="sr-only">Bankalara göre taksit sayısı ve komisyon oranı</caption>
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th scope="col" className="py-1.5 pr-0.5 sm:pr-2 font-semibold">
                    Kart
                  </th>
                  {INSTALLMENT_COUNTS.map((n) => (
                    <th
                      key={n}
                      scope="col"
                      className={`py-1.5 px-0.5 sm:px-2 font-semibold text-center leading-tight ${
                        selectedCount === n ? "text-bronze-ink" : ""
                      }`}
                    >
                      <span className="block text-ink">{n}</span>
                      <span className="block font-normal text-[10px] sm:text-xs">taksit</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INSTALLMENT_BANKS.map((b) => {
                  const isBankRow = selectedBank.id === b.id;
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-line transition-colors ${
                        isBankRow ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <th scope="row" className="py-1 pr-0.5 sm:py-1.5 sm:pr-2 font-semibold text-ink">
                        <button
                          type="button"
                          onClick={() => setSelectedBankId(b.id)}
                          aria-label={`${b.name} seç`}
                          className="inline-flex items-center rounded-md text-left focus-visible:outline-2 focus-visible:outline-bronze-ink"
                        >
                          <BankLogo
                            id={b.id}
                            fallbackName={b.name}
                            className="max-sm:dark:px-1 max-sm:dark:py-0.5"
                            imgClassName="max-h-4 sm:max-h-7 max-w-[44px] sm:max-w-[100px]"
                          />
                          <span className="sr-only">{b.name}</span>
                        </button>
                      </th>
                      {INSTALLMENT_COUNTS.map((n) => {
                        const isSelected = isBankRow && selectedCount === n;
                        return (
                          <td key={n} className="p-px sm:p-1 text-center">
                            <button
                              type="button"
                              data-testid={`taksit-hucre-${b.id}-${n}`}
                              aria-pressed={isSelected}
                              aria-label={`${b.name} ${n} taksit ${formatRate(b.rates[n])}`}
                              onClick={() => {
                                setSelectedBankId(b.id);
                                setSelectedCount(n);
                              }}
                              className={`w-full rounded-lg py-1.5 px-0.5 sm:px-2 text-center tabular-nums whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-bronze-ink ${
                                isSelected
                                  ? "bg-amber-100 text-amber-950 border border-amber-500 font-bold shadow-xs"
                                  : "text-ink border border-transparent hover:bg-surface hover:border-line-strong font-medium"
                              }`}
                            >
                              {formatRate(b.rates[n])}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div
          data-testid="taksit-hesaplama"
          aria-live="polite"
          className="shrink-0 border-t border-line bg-surface px-3 sm:px-5 py-3 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-ink">Tahmini Taksit Hesaplama</span>
            <span
              data-testid="taksit-secili-ozet"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950"
            >
              {selectedBank.name} • {selectedCount} Taksit ({formatRate(selectedRate)})
            </span>
          </div>

          {calc ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-xl bg-raised border border-line px-3 py-2">
                <span className="block text-[11px] text-ink-muted">Aylık Taksit</span>
                <span data-testid="taksit-aylik" className="block text-sm sm:text-base font-bold text-bronze-ink tabular-nums mt-0.5">
                  {formatTl(calc.monthly)}
                </span>
                <span className="block text-[10px] text-ink-muted tabular-nums">
                  {calc.count} × {formatTl(calc.monthly)}
                </span>
              </div>
              <div className="rounded-xl bg-raised border border-line px-3 py-2">
                <span className="block text-[11px] text-ink-muted">Toplam Ödeme</span>
                <span data-testid="taksit-toplam" className="block text-sm sm:text-base font-bold text-ink tabular-nums mt-0.5">
                  {formatTl(calc.total)}
                </span>
                <span className="block text-[10px] text-ink-muted tabular-nums">
                  Peşin: {formatTl(calc.baseAmount)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-ink-muted">
              Seçili komisyon oranı: <strong className="text-ink">{formatRate(selectedRate)}</strong>
            </p>
          )}

          <p className="mt-2 text-[11px] text-ink-muted">
            Kesin tutar PayTR ödeme adımında kartınıza göre belirlenir.
          </p>
        </div>
      </div>
    </div>
  );
}

/** "Taksit seçeneklerini gör" bağlantısı + seçilebilir oran tablosu ve tahmini taksit hesaplama penceresi. */
export default function InstallmentLink({ amount, className = "" }: { amount?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`text-xs font-semibold text-bronze-ink underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-bronze-ink ${className}`}
      >
        Taksit seçeneklerini gör
      </button>
      {open && <Dialog amount={amount} onClose={() => setOpen(false)} />}
    </>
  );
}
