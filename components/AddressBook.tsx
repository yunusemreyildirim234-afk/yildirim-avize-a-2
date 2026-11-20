"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { sortByNameTr } from "@/lib/sort-tr";
import { MAX_ADDRESSES } from "@/lib/address-book";
import { isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { titleCaseTr } from "@/lib/display-case";

export interface SavedAddress {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  stateId: number;
  stateName: string;
  cityId: number;
  cityName: string;
  address: string;
  isDefault: boolean;
}

interface Loc {
  id: number;
  name: string;
}

type Draft = Omit<SavedAddress, "id"> & { id: string | null };

const emptyDraft = (fullName: string, hasAny: boolean): Draft => ({
  id: null,
  title: "",
  fullName,
  phone: "",
  stateId: 34,
  stateName: "İSTANBUL",
  cityId: 0,
  cityName: "",
  address: "",
  isDefault: !hasAny,
});

const input = "w-full text-base sm:text-sm p-3 rounded-xl border border-line-strong bg-raised focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink";
const label = "block text-xs font-semibold text-ink-muted mb-1";

// Hesabım → Adreslerim (adres defteri). Sunucu doğrulaması /api/user/addresses içindedir; burada yalnızca hızlı geri bildirim vardır.
export default function AddressBook({ defaultName }: { defaultName: string }) {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [states, setStates] = useState<Loc[]>([]);
  const [cities, setCities] = useState<Loc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/user/addresses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((d) => setList(d.addresses ?? []))
      .catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  // İl listesi form ilk açıldığında bir kez; ilçe listesi il değişince yüklenir (seçili ilçe korunur)
  const open = draft !== null;
  useEffect(() => {
    if (!open || states.length > 0) return;
    fetch("/api/kargonomi/locations")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.states) && setStates(d.states))
      .catch(() => {});
  }, [open, states.length]);
  const stateId = draft?.stateId ?? 0;
  useEffect(() => {
    if (!open || !stateId) return;
    let live = true;
    fetch(`/api/kargonomi/locations?stateId=${stateId}`)
      .then((r) => r.json())
      .then((d) => live && Array.isArray(d.cities) && setCities(d.cities))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, stateId]);
  const sortedStates = useMemo(() => sortByNameTr(states), [states]);

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const startNew = () => {
    setError("");
    setCities([]);
    setDraft(emptyDraft(defaultName, (list?.length ?? 0) > 0));
  };
  const startEdit = (a: SavedAddress) => {
    setError("");
    setCities([]);
    setDraft({ ...a });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!isValidPhone(draft.phone)) return setError(PHONE_ERROR);
    if (!draft.cityId) return setError("Lütfen ilçe seçin.");
    setBusy(true);
    setError("");
    try {
      const { id, ...body } = draft;
      const res = await fetch(id ? `/api/user/addresses/${id}` : "/api/user/addresses", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Adres kaydedilemedi.");
      toast.success(id ? "Adres güncellendi" : "Adres kaydedildi");
      setDraft(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (a: SavedAddress) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/user/addresses/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, isDefault: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: SavedAddress) => {
    if (!confirm(`"${a.title}" adresi silinsin mi?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/user/addresses/${a.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Adres silinemedi.");
      toast.success("Adres silindi");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const full = (list?.length ?? 0) >= MAX_ADDRESSES;

  return (
    <section id="adresler" aria-labelledby="adreslerim" className="scroll-mt-24 bg-raised rounded-3xl border border-line p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="adreslerim" className="text-lg font-serif font-bold text-ink">Adreslerim</h2>
        {!draft && (
          <button type="button" onClick={startNew} disabled={full || list === null} className="inline-flex items-center gap-1.5 rounded-xl bg-ink hover:bg-bronze-ink disabled:opacity-50 text-canvas text-xs font-semibold px-3.5 py-2.5 transition-colors">
            <Plus aria-hidden="true" className="w-4 h-4" /> Yeni adres
          </button>
        )}
      </div>

      {list === null && <p className="text-xs text-ink-muted">Adresleriniz yükleniyor...</p>}
      {list !== null && list.length === 0 && !draft && (
        <p className="text-xs text-ink-muted">Kayıtlı adresiniz yok. Adres ekleyerek siparişlerde formu tek tıkla doldurabilirsiniz.</p>
      )}
      {full && !draft && <p className="text-xs text-ink-muted">En fazla {MAX_ADDRESSES} adres kaydedebilirsiniz. Yeni eklemek için birini silin.</p>}

      {list && list.length > 0 && (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} data-testid="kayitli-adres" className="rounded-2xl border border-line p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <MapPin aria-hidden="true" className="w-4 h-4 text-bronze-ink shrink-0" />
                <span className="font-bold text-ink">{a.title}</span>
                {a.isDefault && <span className="rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5">Varsayılan</span>}
              </div>
              <p className="mt-1 text-ink">{a.fullName} · <span className="font-mono text-xs">{a.phone}</span></p>
              <p className="text-ink-muted text-xs mt-0.5">{titleCaseTr(a.address)}, {a.cityName} / {a.stateName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {!a.isDefault && (
                  <button type="button" disabled={busy} onClick={() => makeDefault(a)} className="rounded-lg border border-line-strong px-3 py-2 hover:bg-surface disabled:opacity-50">Varsayılan yap</button>
                )}
                <button type="button" disabled={busy} onClick={() => startEdit(a)} className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-2 hover:bg-surface disabled:opacity-50">
                  <Pencil aria-hidden="true" className="w-3.5 h-3.5" /> Düzenle
                </button>
                <button type="button" disabled={busy} onClick={() => remove(a)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 text-red-800 px-3 py-2 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-bold text-ink">{draft.id ? "Adresi düzenle" : "Yeni adres"}</h3>
          <div>
            <label htmlFor="adr-title" className={label}>Adres başlığı</label>
            <input id="adr-title" value={draft.title} maxLength={40} placeholder="Ev, İş..." onChange={(e) => set({ title: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="adr-name" className={label}>Alıcı ad soyad</label>
            <input id="adr-name" required autoComplete="name" value={draft.fullName} maxLength={120} onChange={(e) => set({ fullName: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="adr-phone" className={label}>Telefon</label>
            <input id="adr-phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="0555 123 45 67" value={draft.phone} maxLength={30} onChange={(e) => set({ phone: e.target.value })} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="adr-state" className={label}>İl</label>
              <select
                id="adr-state"
                value={draft.stateId}
                onChange={(e) => set({ stateId: Number(e.target.value), stateName: sortedStates.find((s) => s.id === Number(e.target.value))?.name ?? "", cityId: 0, cityName: "" })}
                className={input}
              >
                {sortedStates.length === 0 && <option value={draft.stateId}>{draft.stateName}</option>}
                {sortedStates.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adr-city" className={label}>İlçe</label>
              <select
                id="adr-city"
                value={draft.cityId}
                onChange={(e) => set({ cityId: Number(e.target.value), cityName: cities.find((c) => c.id === Number(e.target.value))?.name ?? "" })}
                className={input}
              >
                <option value={0}>İlçe seçin</option>
                {draft.cityId > 0 && !cities.some((c) => c.id === draft.cityId) && <option value={draft.cityId}>{draft.cityName}</option>}
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="adr-address" className={label}>Açık adres</label>
            <textarea id="adr-address" required rows={2} autoComplete="street-address" placeholder="Mahalle, sokak, bina ve daire no" value={draft.address} maxLength={500} onChange={(e) => set({ address: e.target.value })} className={input} />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={draft.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} className="w-4 h-4 accent-bronze-ink" />
            Varsayılan adres olarak kullan
          </label>
          {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-ink hover:bg-bronze-ink disabled:opacity-50 text-canvas text-sm font-semibold px-5 py-3 rounded-xl transition-colors">{busy ? "Kaydediliyor..." : "Kaydet"}</button>
            <button type="button" disabled={busy} onClick={() => setDraft(null)} className="border border-line-strong text-sm font-semibold px-5 py-3 rounded-xl hover:bg-raised">Vazgeç</button>
          </div>
        </form>
      )}
      <p className="text-[11px] text-ink-muted">
        Adresleriniz yalnızca siparişlerde formu doldurmak için saklanır; dilediğiniz zaman silebilirsiniz. Ayrıntı:{" "}
        <a href="/aydinlatma-metni" className="text-bronze-ink underline">Aydınlatma Metni</a>.
      </p>
    </section>
  );
}
