"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, FolderTree } from "lucide-react";
import { useOpenOnHash } from "@/components/useOpenOnHash";
import { MAX_CATEGORY_NAME, type CategorySettings } from "@/lib/category-settings";

export interface CategoryRowInfo {
  key: string;
  slug: string;
  title: string; // sabit kategoride varsayılan başlık; diğerlerinde kategori adı
  count: number;
  fixed: boolean;
}

interface Props {
  entries: CategoryRowInfo[];
  settings: CategorySettings;
  uncategorized: number;
}

const inputCls = "p-2 rounded-lg border border-neutral-300 bg-white text-xs focus:outline-none focus:border-amber-600 min-w-0";
const btnCls = "text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 px-3 min-h-9 rounded-lg";

export default function AdminCategories({ entries, settings, uncategorized }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useOpenOnHash("kategoriler", setOpen);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<{ snapshot: unknown; label: string } | null>(null);

  const draftOf = (e: CategoryRowInfo) => drafts[e.key] ?? (e.fixed ? settings[e.key]?.title ?? e.title : e.title);
  const setDraft = (key: string, v: string) => setDrafts((d) => ({ ...d, [key]: v }));

  const call = async (body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, data, status: res.status };
    } catch {
      return { ok: false, data: { error: "Bağlantı hatası oluştu." }, status: 0 };
    } finally {
      setBusy(false);
    }
  };

  const setting = async (e: CategoryRowInfo, patch: { title?: string | null; hidden?: boolean | null }, okMsg: string) => {
    const r = await call({ action: "setting", key: e.key, ...patch });
    if (!r.ok) return toast.error(String(r.data.error || "Kaydedilemedi."));
    toast.success(okMsg);
    setDrafts((d) => {
      const n = { ...d };
      delete n[e.key];
      return n;
    });
    router.refresh();
  };

  const rename = async (e: CategoryRowInfo) => {
    const name = draftOf(e).trim();
    if (!name) return toast.error("Ad boş olamaz.");
    let r = await call({ action: "rename", key: e.key, name });
    if (r.status === 409 && r.data.needsMerge) {
      if (!confirm(`${String(r.data.error)}\n\n"${e.title}" kategorisindeki ${e.count} ürün hedef kategoriye taşınır ve eski adres yeni adrese yönlenir.`)) return;
      r = await call({ action: "rename", key: e.key, name, confirmMerge: true });
    }
    if (!r.ok) return toast.error(String(r.data.error || "Ad değiştirilemedi."));
    toast.success(r.data.merged ? `Kategoriler birleştirildi: ${String(r.data.newName)}` : `Ad değiştirildi: ${String(r.data.newName)}`);
    setDrafts((d) => {
      const n = { ...d };
      delete n[e.key];
      return n;
    });
    router.refresh();
  };

  const remove = async (e: CategoryRowInfo) => {
    if (!confirm(`"${e.title}" kategorisi silinsin mi?\n\n${e.count} ürün kategorisiz kalacak; ürünler SİLİNMEZ (yalnızca "Tüm Ürünler" ve aramada görünür). Eski adres 404 verir.`)) return;
    const r = await call({ action: "delete", key: e.key });
    if (!r.ok) return toast.error(String(r.data.error || "Silinemedi."));
    toast.success(`"${e.title}" silindi; ${String(r.data.updated)} ürün kategorisiz kaldı.`);
    if (r.data.snapshot) setUndo({ snapshot: r.data.snapshot, label: `"${e.title}" kategorisini silme` });
    router.refresh();
  };

  const doUndo = async (force = false): Promise<void> => {
    if (!undo) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: undo.snapshot, force }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.conflict && !force && confirm(`${data.error}\n\nYine de geri alınsın mı?`)) {
          setBusy(false);
          return doUndo(true);
        }
        return void toast.error(data.error || "Geri alınamadı.");
      }
      toast.success("Geri alındı: ürünlerin kategorisi eski haline döndü. Ana sayfa koleksiyon seçiminde gerekirse kategoriyi yeniden işaretleyin.");
      setUndo(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="kategoriler" className="scroll-mt-[var(--admin-offset,6rem)] bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-categories-panel"
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <FolderTree aria-hidden="true" className="w-4 h-4 text-amber-600" /> Kategoriler
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {entries.length} kategori{uncategorized > 0 ? `, ${uncategorized} kategorisiz ürün` : ""}. Sabit kategorilerin görünen adını değiştirin veya menüden gizleyin; eklediğiniz kategorileri yeniden adlandırın ya da silin.
          </p>
        </div>
        <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="admin-categories-panel" className="border-t border-neutral-100 p-6 space-y-4">
          {undo && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
              <span className="flex-1 min-w-0">{undo.label} yapıldı. 30 dakika içinde geri alabilirsiniz.</span>
              <button type="button" disabled={busy} onClick={() => doUndo()} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 min-h-9 rounded-lg">
                Geri Al
              </button>
              <button type="button" onClick={() => setUndo(null)} className="font-semibold underline">
                Kapat
              </button>
            </div>
          )}

          <ul className="space-y-3">
            {entries.map((e) => {
              const s = settings[e.key];
              const draft = draftOf(e);
              return (
                <li key={e.key} className="rounded-xl border border-neutral-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-bold text-neutral-900 text-sm">{e.fixed ? s?.title ?? e.title : e.title}</span>
                    <span className="text-neutral-500">{e.count} ürün</span>
                    {e.count === 0 && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">vitrinde ürün yok</span>}
                    <span className="font-mono text-neutral-400">/kategori/{e.slug}</span>
                    {e.fixed && <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">Sabit</span>}
                    {s?.hidden && <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">Menüden gizli</span>}
                    {e.fixed && s?.title && <span className="text-[11px] text-neutral-400">Varsayılan: {e.title}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`cat-${e.key}`}>
                      {e.fixed ? "Görünen ad" : "Kategori adı"}
                    </label>
                    <input id={`cat-${e.key}`} value={draft} maxLength={MAX_CATEGORY_NAME} onChange={(ev) => setDraft(e.key, ev.target.value)} className={`${inputCls} flex-1 basis-48`} />
                    {e.fixed ? (
                      <>
                        <button type="button" disabled={busy || !draft.trim() || draft.trim() === (s?.title ?? e.title)} onClick={() => setting(e, { title: draft.trim() }, "Görünen ad kaydedildi.")} className={btnCls}>
                          Görünen adı değiştir
                        </button>
                        <button type="button" disabled={busy} onClick={() => setting(e, { hidden: !s?.hidden }, s?.hidden ? "Menüde gösteriliyor." : "Menüden gizlendi (adres çalışmaya devam eder).")} className={btnCls}>
                          {s?.hidden ? "Menüde göster" : "Menüden gizle"}
                        </button>
                        {s && (
                          <button type="button" disabled={busy} onClick={() => setting(e, { title: null, hidden: null }, "Varsayılana döndü.")} className="text-xs font-semibold text-amber-800 hover:underline min-h-9 px-1">
                            Varsayılana dön
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button type="button" disabled={busy || !draft.trim() || draft.trim() === e.title} onClick={() => rename(e)} className={btnCls}>
                          Adı değiştir
                        </button>
                        <button type="button" disabled={busy} onClick={() => remove(e)} className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 px-3 min-h-9 rounded-lg">
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                  {e.fixed && <p className="text-[11px] text-neutral-500">Veritabanı adı ve adres değişmez; yalnızca sitede görünen ad değişir. Gizli kategori menü, alt bilgi, ana sayfa satırı ve sitemap&apos;ten çıkar; adresi ve ürünleri çalışmaya devam eder.</p>}
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] text-neutral-500">
            Kategorisiz ürünler yalnızca &quot;Tüm Ürünler&quot; ve aramada görünür; Tüm Ürünler panelindeki &quot;Kategorisiz&quot; çipinden seçip toplu çubukla kategori atayabilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
