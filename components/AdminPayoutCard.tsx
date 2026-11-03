"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { dayLabel, dayLabelLong, type PayoutGroup, type PayoutSummary } from "@/lib/payout";

const tl = (kurus: number) => `${(kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

function Group({ g, paid }: { g: PayoutGroup; paid?: boolean }) {
  return (
    <section aria-label={`${dayLabel(g.day)} yatış`} className={paid ? "opacity-60" : ""}>
      <h4 className="text-sm font-bold text-neutral-900">
        {dayLabel(g.day)} — {tl(g.netKurus)} net · {g.rows.length} sipariş
        {paid && <span className="ml-2 text-[11px] font-semibold text-neutral-600 border border-neutral-300 rounded px-1.5 py-0.5">Yattı (tahmini)</span>}
      </h4>
      <ul className="mt-2 divide-y divide-neutral-100 border border-neutral-200 rounded-xl bg-white">
        {g.rows.map((r) => (
          <li key={r.id} className="p-3 text-xs">
            <p className="font-mono font-semibold text-neutral-900">#{r.id.slice(0, 8)}</p>
            <dl className="mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1">
              <div><dt className="text-neutral-500">Sipariş tarihi</dt><dd className="text-neutral-900">{dayLabelLong(r.orderDay)}</dd></div>
              <div><dt className="text-neutral-500">Yatış tarihi</dt><dd className="text-neutral-900">{dayLabelLong(r.payoutDay)}</dd></div>
              <div><dt className="text-neutral-500">Brüt</dt><dd className="text-neutral-900">{tl(r.grossKurus)}</dd></div>
              <div><dt className="text-neutral-500">Komisyon</dt><dd className="text-neutral-900">{tl(r.commissionKurus)}</dd></div>
              <div><dt className="text-neutral-500">Net</dt><dd className="font-bold text-neutral-900">{tl(r.netKurus)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Kuveyt Türk Hesabı": bekleyen (tahmini) PayTR yatışları. Yalnızca gösterim. Kart ızgara hücresidir; açılınca liste tam genişlikte altına açılır. */
export default function AdminPayoutCard({ summary }: { summary: PayoutSummary }) {
  const [open, setOpen] = useState(false);
  const empty = summary.pending.length === 0 && summary.paid.length === 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="kuveyt-panel"
        className="text-left bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm hover:bg-neutral-50/60 transition-colors focus-visible:outline-2 focus-visible:outline-amber-600 min-w-0"
      >
        <span className="flex items-center justify-between gap-2 text-xs text-neutral-500 font-medium">
          Kuveyt Türk Hesabı
          <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
        <span className="text-2xl font-bold text-neutral-900 mt-1 block break-words">{tl(summary.pendingKurus)}</span>
        <span className="text-[11px] text-neutral-500 mt-1 block">Bekleyen (tahmini)</span>
      </button>
      <div id="kuveyt-panel" hidden={!open} className="col-span-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 space-y-5 min-w-0">
        {empty && <p className="text-sm text-neutral-600">Bekleyen kartlı ödeme yok.</p>}
        {!empty && summary.pending.length === 0 && <p className="text-sm text-neutral-600">Bekleyen kartlı ödeme yok.</p>}
        {summary.pending.map((g) => <Group key={g.day} g={g} />)}
        {summary.paid.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Yattı (tahmini) — toplama katılmaz</h3>
            {summary.paid.map((g) => <Group key={g.day} g={g} paid />)}
          </div>
        )}
        <p className="text-[11px] text-neutral-600 border-t border-neutral-200 pt-3">
          Havale ile gelenler hemen yatar, burada listelenmez. Tahmini: gerçek yatış banka/hafta sonu durumuna göre değişebilir.
        </p>
      </div>
    </>
  );
}
