"use client";

import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import { BANK_INFO } from "@/lib/site";

const IBAN_GROUPED = BANK_INFO.iban.replace(/(.{4})/g, "$1 ").trim();

export default function BankTransferCard({ orderId }: { orderId?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BANK_INFO.iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("IBAN'ı kopyalayın:", BANK_INFO.iban);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 text-xs text-left space-y-3">
      <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
        <Landmark aria-hidden="true" className="w-4 h-4" /> Havale / EFT Bilgileri
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-neutral-500">Banka</dt>
        <dd className="font-semibold text-neutral-900">{BANK_INFO.bank}</dd>
        <dt className="text-neutral-500">Alıcı Adı</dt>
        <dd className="font-semibold text-neutral-900">{BANK_INFO.holder}</dd>
      </dl>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
        <span className="font-mono font-bold text-neutral-900 text-[13px] break-all">{IBAN_GROUPED}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 transition-colors"
        >
          {copied ? <Check aria-hidden="true" className="w-3.5 h-3.5" /> : <Copy aria-hidden="true" className="w-3.5 h-3.5" />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>

      {orderId && (
        <div className="rounded-xl bg-white border border-neutral-200 px-3 py-2">
          <span className="text-neutral-500">Sipariş Numaranız (açıklamaya yazın):</span>
          <p className="font-mono font-bold text-neutral-900 break-all">{orderId}</p>
        </div>
      )}

      <p role="note" className="rounded-xl bg-red-50 border border-red-200 text-red-800 font-semibold px-3 py-2.5">
        Lütfen havale/EFT açıklama kısmına Sipariş Numaranızı yazmayı unutmayınız.
      </p>
    </div>
  );
}
