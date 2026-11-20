"use client";

import { Landmark } from "lucide-react";
import { BANK_INFO } from "@/lib/site";
import { bankPaymentDeadline, formatIstanbul, formatTl, orderCode } from "@/lib/order-display";
import CopyCodeButton from "@/components/CopyCodeButton";

const IBAN_GROUPED = BANK_INFO.iban.replace(/(.{4})/g, "$1 ").trim();

/** Hesabım → havale bekleyen sipariş kartı: ödeme bilgileri (katlanır, açık gelir). */
export default function OrderBankBox({ orderId, total, createdAt, receiptUploaded }: { orderId: string; total: number; createdAt: string; receiptUploaded: boolean }) {
  const code = orderCode(orderId);
  return (
    <details open className="rounded-xl border border-amber-200 bg-amber-50/60 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 font-bold text-amber-950 focus-visible:outline-2 focus-visible:outline-bronze-ink">
        <Landmark aria-hidden="true" className="w-4 h-4" /> Havale / EFT bilgileri
      </summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-3 pb-3 items-center">
        <dt className="text-ink-muted">Gönderilecek tutar</dt>
        <dd className="font-bold text-ink flex flex-wrap items-center gap-2">
          {formatTl(total)} <CopyCodeButton text={total.toFixed(2).replace(".", ",")} label="Tutar kopyalandı" />
        </dd>
        <dt className="text-ink-muted">Banka</dt>
        <dd className="font-semibold text-ink">{BANK_INFO.bank}</dd>
        <dt className="text-ink-muted">Alıcı adı</dt>
        <dd className="font-semibold text-ink flex flex-wrap items-center gap-2">
          {BANK_INFO.holder} <CopyCodeButton text={BANK_INFO.holder} label="Alıcı adı kopyalandı" />
        </dd>
        <dt className="text-ink-muted">IBAN</dt>
        <dd className="font-mono font-bold text-ink flex flex-wrap items-center gap-2">
          <span className="break-all">{IBAN_GROUPED}</span> <CopyCodeButton text={BANK_INFO.iban} label="IBAN kopyalandı" />
        </dd>
        <dt className="text-ink-muted">Açıklama</dt>
        <dd className="font-mono font-bold text-ink flex flex-wrap items-center gap-2">
          {code} <CopyCodeButton text={code} label="Sipariş kodu kopyalandı" />
        </dd>
        {!receiptUploaded && (
          <>
            <dt className="text-ink-muted">Son ödeme</dt>
            <dd className="font-semibold text-bronze-ink">{formatIstanbul(bankPaymentDeadline(new Date(createdAt)))}</dd>
          </>
        )}
      </dl>
    </details>
  );
}
