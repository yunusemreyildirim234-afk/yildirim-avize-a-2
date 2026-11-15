"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useSectionOpen } from "@/components/SectionOpen";
import type { ComplementReport, ReportGroup, ReportTotals } from "@/lib/complement-report";

interface Payload {
  report: ComplementReport;
  names: Record<string, string>;
  truncated: boolean;
  limit: number;
}
type View = "main" | "complement";
type SortKey = "discount" | "quantity" | "net";

const PRESETS: { id: string; label: string }[] = [
  { id: "", label: "Tüm zamanlar" },
  { id: "bugun", label: "Bugün" },
  { id: "son7", label: "Son 7 gün" },
  { id: "ay", label: "Bu ay" },
  { id: "ozel", label: "Özel aralık" },
];
const SORTS: { id: SortKey; label: string }[] = [
  { id: "discount", label: "Verilen indirim" },
  { id: "quantity", label: "Satılan adet" },
  { id: "net", label: "Net ciro" },
];
const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const input = "rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-xs focus-visible:outline-2 focus-visible:outline-amber-600";
const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

/** "Tamamlayıcı Satışlar": birlikte alma indirimiyle satılan ürünler (sipariş oluşturulma tarihine göre; iptal, iade ve ödenmemiş siparişler hariç). */
export default function AdminComplementReport() {
  const open = useSectionOpen();
  const [preset, setPreset] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<View>("main");
  const [sort, setSort] = useState<SortKey>("discount");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (preset) sp.set("tarih", preset);
    if (preset === "ozel") {
      if (from) sp.set("bas", from);
      if (to) sp.set("bit", to);
    }
    return sp.toString();
  }, [preset, from, to]);

  // Veri yalnız bölüm açılınca (ve süzgeç değişince) çekilir; sayfa açılışında sorgu yok
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/complement-report${qs ? `?${qs}` : ""}`)
        .then(async (res) => ({ res, j: await res.json().catch(() => ({})) }))
        .then(({ res, j }) => {
          if (!alive) return;
          if (!res.ok) return setError(j.error ?? "Rapor alınamadı.");
          setError(null);
          setData(j);
          setExpanded(new Set());
        })
        .catch(() => alive && setError("Rapor alınamadı. Bağlantınızı kontrol edin."))
        .finally(() => alive && setLoading(false));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, qs]);

  const name = (id: string) => data?.names[id] ?? "Silinmiş ürün";
  const sorted = useMemo(() => {
    if (!data) return [];
    const groups = view === "main" ? data.report.byMain : data.report.byComplement;
    return [...groups].sort((a, b) => b[sort] - a[sort] || a.id.localeCompare(b.id));
  }, [data, view, sort]);
  const s = data?.report.summary;
  const toggle = (id: string) => setExpanded((e) => { const n = new Set(e); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cells = (t: ReportTotals) => (
    <>
      <td className={num}>{t.quantity}</td>
      <td className={num}>{t.orders}</td>
      <td className={num}>{tl(t.list)}</td>
      <td className={num}>{tl(t.discount)}</td>
      <td className={`${num} font-semibold`}>{tl(t.net)}</td>
    </>
  );

  return (
    <div className="p-5 sm:p-6 space-y-4 text-sm text-neutral-800">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-neutral-600">
          <span className="block mb-1">Tarih (sipariş verilme günü)</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={input}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {preset === "ozel" && (
          <>
            <label className="text-xs font-semibold text-neutral-600"><span className="block mb-1">Başlangıç</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} /></label>
            <label className="text-xs font-semibold text-neutral-600"><span className="block mb-1">Bitiş</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} /></label>
          </>
        )}
        <label className="text-xs font-semibold text-neutral-600">
          <span className="block mb-1">Sırala</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={input}>
            {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Görünüm" className="inline-flex rounded-lg border border-neutral-300 overflow-hidden">
          {([["main", "Ana ürüne göre"], ["complement", "Tamamlayıcıya göre"]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setExpanded(new Set()); }} className={`min-h-9 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-amber-600 ${view === v ? "bg-amber-600 text-white" : "bg-white text-neutral-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
      {loading && !data && <p role="status" className="text-xs text-neutral-500">Rapor yükleniyor…</p>}

      {data && s && (
        <div className={loading ? "opacity-60" : ""} aria-busy={loading}>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[["Tamamlayıcı adet", String(s.quantity)], ["Birlikte alınan sipariş", String(s.orders)], ["Verilen indirim", tl(s.discount)], ["Net ciro", tl(s.net)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <dt className="text-[11px] font-medium text-neutral-500">{k}</dt>
                <dd className="mt-0.5 text-lg font-bold text-neutral-900 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {sorted.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-500">Bu aralıkta birlikte alma indirimiyle satılan ürün yok.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs">
                <caption className="sr-only">Tamamlayıcı satışlar: {view === "main" ? "ana üründen tamamlayıcıya" : "tamamlayıcıdan ana ürüne"}</caption>
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{view === "main" ? "Ana ürün → tamamlayıcı" : "Tamamlayıcı → ana ürün"}</th>
                    {["Adet", "Sipariş", "Liste tutarı", "Verilen indirim", "Net ciro"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sorted.map((g: ReportGroup) => {
                    const on = expanded.has(g.id);
                    return (
                      <Fragment key={g.id}>
                        <tr className="bg-white font-semibold">
                          <th scope="row" className="px-3 py-2 text-left font-semibold">
                            <button type="button" aria-expanded={on} onClick={() => toggle(g.id)} className="inline-flex items-center gap-1.5 text-left hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600 rounded">
                              <ChevronRight aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 transition-transform ${on ? "rotate-90" : ""}`} />
                              {name(g.id)}
                            </button>
                          </th>
                          {cells(g)}
                        </tr>
                        {on && g.items.map((i) => (
                          <tr key={`${i.mainId}|${i.complementId}`} className="bg-neutral-50/60 text-neutral-700">
                            <th scope="row" className="px-3 py-2 pl-9 text-left font-normal">→ {name(view === "main" ? i.complementId : i.mainId)}</th>
                            {cells(i)}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.report.excludedOrders > 0 && (
            <p className="mt-3 text-xs text-neutral-600">{data.report.excludedOrders} sipariş ödeme/iptal/iade nedeniyle sayılmadı.</p>
          )}
          {data.truncated && <p role="alert" className="mt-2 text-xs font-semibold text-amber-800">Çok fazla kayıt var (en yeni {data.limit} kalem gösterildi). Tarih aralığını daraltın.</p>}
          <p className="mt-2 text-[11px] text-neutral-500">Yalnız birlikte alma özelliği açıldıktan sonraki siparişler. Havale siparişi, onaylanınca verildiği günün raporuna girer.</p>
        </div>
      )}
    </div>
  );
}
