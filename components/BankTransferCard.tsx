"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import { BANK_INFO } from "@/lib/site";
import { isKuveytTurk } from "@/lib/installments";
import BankLogo from "@/components/BankLogo";
import { formatTl, orderCode } from "@/lib/order-display";
import CopyCodeButton from "@/components/CopyCodeButton";

const IBAN_GROUPED = BANK_INFO.iban.replace(/(.{4})/g, "$1 ").trim();

export default function BankTransferCard({ orderId, amount }: { orderId?: string; amount?: number }) {
  const [copied, setCopied] = useState<"iban" | "holder" | null>(null);

  const copy = async (kind: "iban" | "holder") => {
    const text = kind === "iban" ? BANK_INFO.iban : BANK_INFO.holder;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "iban" ? "IBAN kopyalandı" : "Alıcı adı kopyalandı");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Kopyalayın:", text);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 text-xs text-left space-y-3">
      <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
        <Landmark aria-hidden="true" className="w-4 h-4" /> Havale / EFT Bilgileri
      </div>

      {amount !== undefined && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
          <span>
            <span className="text-neutral-500">Gönderilecek tutar</span>
            <span className="block font-bold text-neutral-900 text-sm">{formatTl(amount)}</span>
          </span>
          <CopyCodeButton text={amount.toFixed(2).replace(".", ",")} label="Tutar kopyalandı" />
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-neutral-500">Banka</dt>
        <dd className="font-semibold text-neutral-900 flex flex-wrap items-center gap-2">
          {BANK_INFO.bank}
          {isKuveytTurk(BANK_INFO.bank) && <BankLogo id="kuveytturk" height={18} />}
        </dd>
        <dt className="text-neutral-500">Alıcı Adı</dt>
        <dd className="font-semibold text-neutral-900 flex flex-wrap items-center gap-2">
          {BANK_INFO.holder}
          <button
            type="button"
            onClick={() => copy("holder")}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 hover:bg-amber-600 text-white text-[10px] font-semibold px-2 py-1 transition-colors"
          >
            {copied === "holder" ? <Check aria-hidden="true" className="w-3 h-3" /> : <Copy aria-hidden="true" className="w-3 h-3" />}
            {copied === "holder" ? "Kopyalandı" : "Kopyala"}
          </button>
        </dd>
      </dl>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-3 py-2.5">
        <span className="font-mono font-bold text-neutral-900 text-[13px] break-all">{IBAN_GROUPED}</span>
        <button
          type="button"
          onClick={() => copy("iban")}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 transition-colors"
        >
          {copied === "iban" ? <Check aria-hidden="true" className="w-3.5 h-3.5" /> : <Copy aria-hidden="true" className="w-3.5 h-3.5" />}
          {copied === "iban" ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>

      {orderId && (
        <div className="rounded-xl bg-white border border-neutral-200 px-3 py-2">
          <span className="text-neutral-500">Sipariş Kodunuz (açıklamaya yazın):</span>
          <p className="font-mono font-bold text-neutral-900 text-[13px] flex flex-wrap items-center gap-2">
            {orderCode(orderId)} <CopyCodeButton text={orderCode(orderId)} label="Sipariş kodu kopyalandı" />
          </p>
        </div>
      )}

      <p role="note" className="rounded-xl bg-amber-100 border border-amber-300 text-amber-950 font-semibold px-3 py-2.5">
        Lütfen havale/EFT açıklama kısmına Sipariş Kodunuzu yazmayı unutmayınız.
      </p>
    </div>
  );
}
