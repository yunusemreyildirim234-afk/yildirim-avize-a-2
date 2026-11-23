"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MonthlyRevenue } from "@/lib/monthly-revenue";

const num = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tl = (n: number) => `${num(n)} ₺`;

/** "Bu Ayın Cirosu" kartı; açılınca aylık tablo tam genişlikte altına açılır. */
export default function AdminRevenueCard({ data, totalRevenue }: { data: MonthlyRevenue; totalRevenue: number }) {
  const [open, setOpen] = useState(false);
  const [vatOpen, setVatOpen] = useState(false);
  const cur = data.current;
  const missing = cur.cargoOrders - cur.shipRecorded;
  const th = "py-2 px-1.5 sm:px-3 font-medium text-right";
  const td = "py-2 px-1.5 sm:px-3 text-right tabular-nums";
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
        <span className="text-[11px] text-neutral-500 mt-0.5 block">Kargo gideri: {tl(cur.shipping)} · Kargo düşülmüş: {tl(cur.afterShipping)}</span>
        {missing > 0 && <span className="text-[11px] text-neutral-500 mt-0.5 block">Kargo kayıtlı: {cur.shipRecorded}/{cur.cargoOrders} sipariş</span>}
      </button>
      <div id="ciro-panel" hidden={!open} className="col-span-full bg-neutral-50 border border-neutral-200 rounded-2xl p-3 sm:p-5 min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] sm:text-sm">
            <thead>
              <tr className="text-left text-[11px] sm:text-xs text-neutral-500 border-b border-neutral-200">
                <th scope="col" className="py-2 pr-1.5 sm:pr-3 font-medium">Ay</th>
                <th scope="col" className={th}>Sipariş</th>
                <th scope="col" className={th}>Ciro</th>
                <th scope="col" className={th}>Kargo</th>
                <th scope="col" className={th}>Kargo düşülmüş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.months.map((m) => (
                <tr key={m.key} className={m.key === data.currentKey ? "bg-amber-50 font-semibold text-neutral-900" : "text-neutral-700"}>
                  <td className="py-2 pr-1.5 sm:pr-3">{m.label}</td>
                  <td className={td}>{m.orderCount}</td>
                  <td className={td}>{num(m.revenue)}</td>
                  <td className={td}>{num(m.shipping)}</td>
                  <td className={td}>{num(m.afterShipping)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-bold text-neutral-900">
                <th scope="row" className="py-2 pr-1.5 sm:pr-3 text-left">Toplam</th>
                <td className={td}>{data.totals.orderCount}</td>
                <td className={td}>{num(data.totals.revenue)}</td>
                <td className={td}>{num(data.totals.shipping)}</td>
                <td className={td}>{num(data.totals.afterShipping)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-neutral-600 mt-3">Aylar sipariş tarihine göre · Tutarlar ₺</p>

        <button
          type="button"
          onClick={() => setVatOpen((o) => !o)}
          aria-expanded={vatOpen}
          aria-controls="kdv-panel"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          KDV ayrıntısı
          <ChevronDown aria-hidden="true" className={`w-4 h-4 transition-transform ${vatOpen ? "rotate-180" : ""}`} />
        </button>
        <div id="kdv-panel" hidden={!vatOpen} className="mt-3 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] sm:text-sm">
              <thead>
                <tr className="text-left text-[11px] sm:text-xs text-neutral-500 border-b border-neutral-200">
                  <th scope="col" className="py-2 pr-1.5 sm:pr-3 font-medium"> </th>
                  <th scope="col" className={th}>{data.currentLabel}</th>
                  <th scope="col" className={th}>Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {(
                  [
                    ["Satışlardaki KDV", cur.vat.salesVat, data.totals.vat.salesVat],
                    ["Kargo faturasındaki KDV (indirilebilir olabilir)", cur.vat.shippingVat, data.totals.vat.shippingVat],
                    ["KDV hariç ciro", cur.vat.revenueExVat, data.totals.vat.revenueExVat],
                    ["KDV hariç kargo düşülmüş ciro", cur.vat.afterShippingExVat, data.totals.vat.afterShippingExVat],
                  ] as const
                ).map(([label, a, b]) => (
                  <tr key={label}>
                    <td className="py-2 pr-1.5 sm:pr-3">{label}</td>
                    <td className={td}>{num(a)}</td>
                    <td className={td}>{num(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-neutral-600">
            Tahmini, %20 varsayımıyla. Ödenecek KDV değildir; diğer alışlardaki KDV düşülmemiştir. Beyan için muhasebecinize danışın.
          </p>
          <div>
            <h3 className="text-xs font-medium text-neutral-500 mb-1">Firmaya göre kargo gideri · {data.currentLabel}</h3>
            {cur.carriers.length === 0 ? (
              <p className="text-[11px] text-neutral-600">Bu ay kayıtlı kargo ücreti yok.</p>
            ) : (
              <ul className="text-[11px] sm:text-sm text-neutral-700 divide-y divide-neutral-100">
                {cur.carriers.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 break-words">{c.name} · {c.count} adet</span>
                    <span className="tabular-nums whitespace-nowrap">{tl(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
