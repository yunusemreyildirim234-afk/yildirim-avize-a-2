"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { bulkTiersOf, tierValueLabel } from "@/lib/bulk-pricing";
import { DEFAULT_SUGGEST_COUNT, MAX_COMPLEMENTS_PER_MAIN, MAX_SUGGEST_COUNT, parseSuggestCount, validateComplementDiscount } from "@/lib/complements";

export interface ComplementProduct {
  id: string;
  title: string;
  modelCode?: string | null;
  active?: boolean;
  bulkTiers?: unknown;
}

interface Link {
  id: string;
  mainProductId: string;
  complementProductId: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
}
interface Preview {
  dryRun: boolean;
  mains: number;
  complements: number;
  created: number;
  updated: number;
  skipped: number;
  skippedItems: { mainId: string; complementId: string; reason: string }[];
  warnings: string[];
}

const API = "/api/admin/product/complements";
const tl = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;
const valueLabel = (t: string, v: number) => (t === "PERCENT" ? `%${v.toLocaleString("tr-TR")}` : tl(v));
const field = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-amber-600";
const btn = "inline-flex items-center justify-center min-h-10 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-50";

/** "Tamamlayıcı ürün ekle": seçili ana ürünlere "bununla birlikte alın" bağı kurar, mevcut bağları kaldırır, öneri kartı sayısını ayarlar. */
export default function AdminComplementDialog({ mainIds, products, onClose, onChanged }: { mainIds: string[]; products: ComplementProduct[]; onClose: () => void; onChanged: () => void }) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const nameOf = (id: string) => byId.get(id)?.title ?? "Silinmiş ürün";

  const [mains, setMains] = useState<string[]>(mainIds);
  const [comps, setComps] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("10");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [allMains, setAllMains] = useState<Set<string>>(new Set());
  const [allComps, setAllComps] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set()); // kaldırılmak üzere işaretli bağ kimlikleri
  const [removeAsk, setRemoveAsk] = useState<string[] | null>(null);
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mainsKey = mains.join(",");
  const [tick, setTick] = useState(0); // değişiklikten sonra bağları yeniden okutur
  useEffect(() => {
    let alive = true;
    fetch(`${API}?ids=${encodeURIComponent(mainsKey)}`)
      .then(async (res) => ({ res, j: await res.json() }))
      .then(({ res, j }) => {
        if (!alive) return;
        if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Bağlar okunamadı." });
        setLinks(j.links);
        setAllMains(new Set(j.mainIds));
        setAllComps(new Set(j.complementIds));
        setPicked(new Set());
      })
      .catch(() => alive && setMsg({ ok: false, text: "Bağlar okunamadı. Bağlantınızı kontrol edin." }));
    return () => { alive = false; };
  }, [mainsKey, tick]);
  useEffect(() => {
    fetch("/api/admin/complement-settings")
      .then((r) => r.json())
      .then((j) => setCount(j.count === null || j.count === undefined ? "" : String(j.count)))
      .catch(() => {});
  }, []);

  const mainSet = useMemo(() => new Set(mains), [mains]);
  const num = Number(value.replace(",", "."));
  const discountError = validateComplementDiscount(type, num);
  const reset = () => setPreview(null);

  // Tamamlayıcı adayları: seçili ana ürünler ve zaten ana ürün olanlar devre dışı (zincir/döngü yasak)
  const q = query.trim().toLocaleLowerCase("tr");
  const results = useMemo(
    () => (q ? products.filter((p) => p.title.toLocaleLowerCase("tr").includes(q) || (p.modelCode ?? "").toLocaleLowerCase("tr").includes(q)).slice(0, 30) : []),
    [products, q]
  );
  const blockedReason = (id: string) => (mainSet.has(id) ? "Seçili ana ürün" : allMains.has(id) ? "Zaten ana ürün" : null);
  const toggleComp = (id: string) => {
    reset();
    setComps((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPLEMENTS_PER_MAIN ? c : [...c, id]));
  };
  const chainMains = mains.filter((id) => allComps.has(id));

  const stackNotes = comps.flatMap((id) => {
    const tiers = bulkTiersOf(byId.get(id));
    if (!tiers.length) return [];
    const top = tiers[tiers.length - 1];
    return [`«${nameOf(id)}» ürününde adet kademesi var (${top.minQty}+ adet: ${tierValueLabel(top)}). Birlikte alınınca kademe ve bu indirim üst üste uygulanır.`];
  });

  async function call(body: Record<string, unknown>) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return { res, j };
  }
  const payload = (dryRun: boolean) => ({ action: "add", ids: mains, complementIds: comps, type, value: num, dryRun });

  async function runPreview() {
    setBusy(true);
    setMsg(null);
    try {
      const { res, j } = await call(payload(true));
      if (!res.ok) setMsg({ ok: false, text: j.error ?? "Önizleme alınamadı." });
      else setPreview(j);
    } catch {
      setMsg({ ok: false, text: "Önizleme alınamadı. Bağlantınızı kontrol edin." });
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setMsg(null);
    try {
      const { res, j } = await call(payload(false));
      if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Bağlar kaydedilemedi." });
      setMsg({ ok: true, text: `${j.created} bağ eklendi, ${j.updated} bağın indirimi güncellendi${j.skipped ? `, ${j.skipped} bağ atlandı` : ""}.` });
      setPreview(null);
      setComps([]);
      setTick((t) => t + 1);
      onChanged();
    } catch {
      setMsg({ ok: false, text: "Bağlar kaydedilemedi. Bağlantınızı kontrol edin." });
    } finally {
      setBusy(false);
    }
  }
  async function remove(ids: string[]) {
    const pairs = links.filter((l) => ids.includes(l.id)).map((l) => ({ mainId: l.mainProductId, complementId: l.complementProductId }));
    if (!pairs.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const { res, j } = await call({ action: "remove", pairs });
      if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Bağ kaldırılamadı." });
      setMsg({ ok: true, text: `${j.removed} bağ kaldırıldı.` });
      setRemoveAsk(null);
      setTick((t) => t + 1);
      onChanged();
    } catch {
      setMsg({ ok: false, text: "Bağ kaldırılamadı. Bağlantınızı kontrol edin." });
    } finally {
      setBusy(false);
    }
  }
  async function saveCount() {
    const parsed = parseSuggestCount(count);
    if (!parsed.ok) return setMsg({ ok: false, text: parsed.error });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/complement-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: parsed.value }) });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: parsed.value === 0 ? "Öneriler kapatıldı." : `Öneri kartı sayısı ${parsed.value ?? DEFAULT_SUGGEST_COUNT} olarak kaydedildi.` } : { ok: false, text: j.error ?? "Ayar kaydedilemedi." });
      if (res.ok) onChanged();
    } catch {
      setMsg({ ok: false, text: "Ayar kaydedilemedi. Bağlantınızı kontrol edin." });
    } finally {
      setBusy(false);
    }
  }

  const chip = (id: string, onRemove: () => void) => (
    <li key={id} className="inline-flex items-center rounded-full bg-amber-50 border border-amber-300 text-xs text-neutral-800">
      <span className="pl-2.5 pr-1 py-1 max-w-48 truncate">{nameOf(id)}</span>
      <button type="button" aria-label={`${nameOf(id)} çıkar`} onClick={onRemove} className="px-1.5 py-1 text-neutral-500 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-amber-600 rounded-r-full">
        <X aria-hidden="true" className="w-3 h-3" />
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="comp-title" className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-3">
          <h2 id="comp-title" className="text-base font-bold text-neutral-900">Tamamlayıcı ürün ekle</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Kapat" className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-amber-600">
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm text-neutral-800">
          <p className="text-xs text-neutral-600">Ana ürün sepetteyken tamamlayıcı ürün (örn. ampul) indirimli satılır. Varyasyonu (renk, ebat) müşteri seçer.</p>

          <section aria-label="Ana ürünler">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Ana ürünler ({mains.length})</h3>
            {mains.length === 0 ? (
              <p className="text-xs text-red-700">Ana ürün kalmadı; listeden ürün seçin.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">{mains.map((id) => chip(id, () => { reset(); setMains((m) => m.filter((x) => x !== id)); }))}</ul>
            )}
            {chainMains.length > 0 && <p className="mt-1.5 text-xs text-amber-800">{chainMains.map(nameOf).join(", ")} zaten başka bir ürünün tamamlayıcısı; ana ürün olarak atlanır.</p>}
          </section>

          <section aria-label="Tamamlayıcı ürünler">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Tamamlayıcı ürünler ({comps.length}/{MAX_COMPLEMENTS_PER_MAIN})</h3>
            {comps.length > 0 && <ul className="flex flex-wrap gap-1.5 mb-2">{comps.map((id) => chip(id, () => toggleComp(id)))}</ul>}
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Model kodu veya ürün adı ara" aria-label="Tamamlayıcı ürün ara" className={`${field} pl-9`} />
            </div>
            {q && (
              <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                {results.length === 0 && <li className="px-3 py-2 text-xs text-neutral-500">Ürün bulunamadı.</li>}
                {results.map((p) => {
                  const blocked = blockedReason(p.id);
                  const on = comps.includes(p.id);
                  const full = !on && comps.length >= MAX_COMPLEMENTS_PER_MAIN;
                  return (
                    <li key={p.id}>
                      <label className={`flex items-center gap-2 px-3 py-2 text-xs ${blocked || full ? "opacity-50" : "cursor-pointer hover:bg-amber-50"}`}>
                        <input type="checkbox" checked={on} disabled={Boolean(blocked) || full} onChange={() => toggleComp(p.id)} className="w-4 h-4 accent-amber-600" />
                        <span className="flex-1 min-w-0 truncate">{p.title}{p.modelCode ? <span className="text-neutral-500"> · {p.modelCode}</span> : null}</span>
                        {blocked && <span className="text-neutral-500">{blocked}</span>}
                        {p.active === false && !blocked && <span className="text-amber-800">Pasif</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="İndirim">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">İndirim</h3>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="İndirim türü" className="inline-flex rounded-lg border border-neutral-300 overflow-hidden">
                {(["PERCENT", "FIXED"] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => { reset(); setType(t); }} className={`min-h-10 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-600 ${type === t ? "bg-amber-600 text-white" : "bg-white text-neutral-700"}`}>
                    {t === "PERCENT" ? "%" : "TL"}
                  </button>
                ))}
              </div>
              <input inputMode="decimal" value={value} onChange={(e) => { reset(); setValue(e.target.value); }} aria-label="İndirim değeri" aria-invalid={Boolean(discountError)} className={`${field} max-w-32`} />
            </div>
            {discountError && <p role="alert" className="mt-1 text-xs text-red-700">{discountError}</p>}
            {!discountError && type === "PERCENT" && num > 50 && <p className="mt-1 text-xs text-amber-800">Yüksek indirim: %{num.toLocaleString("tr-TR")}. Emin olun.</p>}
            <p className="mt-1.5 text-xs text-neutral-600">Ana ürün sepetteyken tamamlayıcının sepetteki tüm adetleri indirimli olur.</p>
            {stackNotes.map((n) => <p key={n} className="mt-1 text-xs text-amber-800">{n}</p>)}
          </section>

          <section aria-label="Önizleme">
            <button type="button" onClick={runPreview} disabled={busy || mains.length === 0 || comps.length === 0 || Boolean(discountError)} className={`${btn} bg-neutral-900 text-white hover:bg-neutral-800`}>
              Önizle
            </button>
            {preview && (
              <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs space-y-1.5">
                <p className="font-semibold text-neutral-900">
                  {preview.mains} ana ürüne {preview.complements} tamamlayıcı: {preview.created} bağ eklenecek, {preview.updated} bağın indirimi güncellenecek, {preview.skipped} bağ atlanacak.
                </p>
                {preview.skippedItems.length > 0 && (
                  <ul className="list-disc pl-4 text-neutral-700">
                    {[...new Set(preview.skippedItems.map((s) => s.reason))].map((r) => <li key={r}>{r}</li>)}
                    {preview.skipped > preview.skippedItems.length && <li>… ve {preview.skipped - preview.skippedItems.length} atlanan bağ daha.</li>}
                  </ul>
                )}
                {preview.warnings.map((w) => <p key={w} className="text-amber-900">{w}</p>)}
                <button type="button" onClick={apply} disabled={busy || preview.created + preview.updated === 0} className={`${btn} bg-amber-600 text-white hover:bg-amber-700 mt-1`}>
                  Uygula
                </button>
              </div>
            )}
          </section>

          <section aria-label="Mevcut bağlar">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Mevcut bağlar ({links.length})</h3>
            {links.length === 0 ? (
              <p className="text-xs text-neutral-500">Seçili ürünlerde tamamlayıcı bağ yok.</p>
            ) : (
              <>
                <ul className="rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <input type="checkbox" aria-label="Kaldırmak için işaretle" checked={picked.has(l.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} className="w-4 h-4 accent-amber-600" />
                      <span className="flex-1 min-w-0 truncate">{nameOf(l.mainProductId)} → {nameOf(l.complementProductId)}</span>
                      <span className="shrink-0 font-semibold">{valueLabel(l.discountType, l.discountValue)}</span>
                      <button type="button" onClick={() => setRemoveAsk([l.id])} className="shrink-0 text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-amber-600">Kaldır</button>
                    </li>
                  ))}
                </ul>
                {picked.size > 0 && (
                  <button type="button" onClick={() => setRemoveAsk([...picked])} className={`${btn} mt-2 border border-red-300 text-red-800 hover:bg-red-50`}>
                    Seçili {picked.size} bağı kaldır
                  </button>
                )}
              </>
            )}
            {removeAsk && (
              <div role="alertdialog" aria-label="Kaldırmayı onayla" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs">
                <p className="font-semibold text-red-900">{removeAsk.length} bağ silinecek; geri almak için yeniden eklemeniz gerekir.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => remove(removeAsk)} disabled={busy} className={`${btn} bg-red-700 text-white hover:bg-red-800`}>Evet, kaldır</button>
                  <button type="button" onClick={() => setRemoveAsk(null)} className={`${btn} border border-neutral-300 text-neutral-700`}>Vazgeç</button>
                </div>
              </div>
            )}
          </section>

          <section aria-label="Öneri kartı sayısı">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Öneri kartı sayısı</h3>
            <div className="flex items-center gap-2">
              <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder={String(DEFAULT_SUGGEST_COUNT)} aria-label="Öneri kartı sayısı" className={`${field} max-w-24`} />
              <button type="button" onClick={saveCount} disabled={busy} className={`${btn} border border-neutral-300 text-neutral-800 hover:bg-neutral-50`}>Kaydet</button>
            </div>
            <p className="mt-1 text-xs text-neutral-600">0-{MAX_SUGGEST_COUNT} arası tam sayı. Boş: {DEFAULT_SUGGEST_COUNT}. 0: öneriler kapalı.</p>
          </section>

          <div aria-live="polite" className="min-h-5">
            {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-semibold ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
