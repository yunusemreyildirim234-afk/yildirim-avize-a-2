"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MonthlyRevenue } from "@/lib/monthly-revenue";

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

/** "Bu Ayın Cirosu" kartı; açılınca aylık tablo tam genişlikte altına açılır. */
export default function AdminRevenueCard({ data, totalRevenue }: { data: MonthlyRevenue; totalRevenue: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ciro-panel"
        className="text-left bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm hover:bg-neutral-50/60 transition-colors focus-visible:outline-2 focus-visible:outline-amber-600 min-w-0"
      >
        <span className="flex items-center justify-between gap-2 text-xs text-neutral-500 font-medium">
          Bu Ayın Cirosu · {data.currentLabel}
          <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
        <span className="text-2xl font-bold text-neutral-900 mt-1 block break-words">{tl(data.currentRevenue)}</span>
        <span className="text-[11px] text-neutral-500 mt-1 block">Toplam ciro: {tl(totalRevenue)}</span>
      </button>
      <div id="ciro-panel" hidden={!open} className="col-span-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th scope="col" className="py-2 pr-3 font-medium">Ay</th>
                <th scope="col" className="py-2 px-3 font-medium text-right">Sipariş</th>
                <th scope="col" className="py-2 pl-3 font-medium text-right">Ciro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.months.map((m) => (
                <tr key={m.key} className={m.key === data.currentKey ? "bg-amber-50 font-semibold text-neutral-900" : "text-neutral-700"}>
                  <td className="py-2 pr-3">{m.label}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{m.orderCount}</td>
                  <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">{tl(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-bold text-neutral-900">
                <th scope="row" className="py-2 pr-3 text-left">Toplam ciro</th>
                <td className="py-2 px-3 text-right tabular-nums">{data.months.reduce((n, m) => n + m.orderCount, 0)}</td>
                <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">{tl(data.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-neutral-600 mt-3">Aylar sipariş tarihine göre</p>
      </div>
    </>
  );
}
