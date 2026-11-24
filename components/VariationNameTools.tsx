"use client";

import { useState } from "react";
import { Check, Pencil, Wand2, X } from "lucide-react";
import { SECENEK_COLOR_ALLOWLIST, titleTr, type VariationAttrs } from "@/lib/listing-core";
import { distinctColors, planBulkColor, planRename } from "@/lib/variation-input";

export interface NameVariation {
  id: string;
  variationType?: string;
  variationValue: string;
}

type Save = (body: Record<string, unknown>, okMsg: string) => Promise<void>;

const input = "w-full min-h-10 px-3 rounded-lg border border-neutral-300 bg-white text-base sm:text-sm focus:outline-none focus-visible:border-amber-600";
const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-semibold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-amber-600";
const primary = `${btn} bg-neutral-900 hover:bg-amber-600 text-white`;
const ghost = `${btn} border border-neutral-300 bg-white hover:border-amber-600 text-neutral-800`;

/** Filtrenin bir adı nasıl okuyacağı (listing-core'daki variationAttrs sonucundan). */
export const readingOf = (a: VariationAttrs) => `Renk ${a.c?.n ?? "yok"}, Ebat ${a.s?.n ?? "yok"}`;

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="list-disc pl-4 space-y-0.5 text-neutral-600" data-testid="bilgi">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

function Warnings({ warnings, checked, onChange }: { warnings: string[]; checked: boolean; onChange: (v: boolean) => void }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2 text-amber-900" data-testid="uyari">
      <ul className="list-disc pl-4 space-y-0.5">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <label className="flex items-start gap-2 min-h-10 font-semibold cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-5 h-5 accent-amber-600 shrink-0" />
        Yine de kaydet; ebat filtresinde görünmeyebilir
      </label>
    </div>
  );
}

// Tek varyasyonun adı: "Renk" ya da "Renk / Ebat". Barkod, tür, stok, fiyat, fotoğraf ve sıra değişmez.
export function VariationNameEdit({ variation, siblings, productEbat, busy, save }: { variation: NameVariation; siblings: NameVariation[]; productEbat?: string | null; busy: boolean; save: Save }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(variation.variationValue);
  const [confirm, setConfirm] = useState(false);
  const plan = planRename(text, { type: variation.variationType ?? "Renk", current: variation.variationValue, others: siblings.filter((s) => s.id !== variation.id).map((s) => s.variationValue), productEbat });
  const warnings = plan.ok ? plan.value.warnings : [];
  const canSave = plan.ok && (warnings.length === 0 || confirm) && !busy;

  if (!open) {
    return (
      <button type="button" disabled={busy} onClick={() => setOpen(true)} className={ghost} aria-label={`${variation.variationValue} adını düzenle`}>
        <Pencil size={14} aria-hidden /> Adı düzenle
      </button>
    );
  }
  return (
    <div className="basis-full rounded-lg border border-neutral-200 bg-white p-3 space-y-2" data-testid="ad-duzenle">
      <label className="block space-y-1">
        <span className="font-semibold text-neutral-700">Varyasyon adı (&ldquo;Renk&rdquo; ya da &ldquo;Renk / Ebat&rdquo;)</span>
        <input
          aria-label="Varyasyon adı"
          value={text}
          maxLength={80}
          onChange={(e) => {
            setText(e.target.value);
            setConfirm(false);
          }}
          className={input}
        />
      </label>
      {plan.ok ? (
        <p className="text-neutral-700" data-testid="ad-onizleme">
          Filtre bunu şöyle okuyacak: <strong>{readingOf(plan.value.attrs)}</strong>
          {plan.value.value !== text.trim() && <span className="block text-neutral-500">Kaydedilecek ad: {plan.value.value}</span>}
        </p>
      ) : (
        <p role="alert" className="text-red-700 font-semibold" data-testid="ad-hata">
          {plan.error}
        </p>
      )}
      <Notes notes={plan.ok ? plan.value.notes : []} />
      <Warnings warnings={warnings} checked={confirm} onChange={setConfirm} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => save({ variationId: variation.id, variationValue: text, confirmWarnings: confirm }, "✓ Varyasyon adı kaydedildi. Alttaki çubuktan geri alabilirsiniz.")}
          className={primary}
        >
          <Check size={14} aria-hidden /> Adı kaydet
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText(variation.variationValue);
            setConfirm(false);
          }}
          className={ghost}
        >
          <X size={14} aria-hidden /> Vazgeç
        </button>
      </div>
    </div>
  );
}

// Ürünün tüm varyasyonlarında bir rengi başka bir renkle değiştirir (yalnızca renk parçası; ebat korunur; hepsi ya da hiçbiri).
export function BulkColorChange({ productId, variations, busy, save }: { productId: string; variations: NameVariation[]; busy: boolean; save: Save }) {
  const colors = distinctColors(variations.map((v) => ({ value: v.variationValue })));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const reset = () => {
    setPreviewed(false);
    setConfirm(false);
  };
  const plan = planBulkColor(
    variations.map((v) => ({ id: v.id, type: v.variationType ?? "Renk", value: v.variationValue })),
    from,
    to
  );
  const warnings = plan.ok ? plan.value.warnings : [];
  const canApply = previewed && plan.ok && (warnings.length === 0 || confirm) && !busy;

  return (
    <section className="space-y-2 border-t border-neutral-200 pt-4" data-testid="toplu-renk">
      <h4 className="font-semibold text-neutral-700">Rengi toplu değiştir</h4>
      <p className="text-neutral-500">Seçilen rengin adı bu ürünün tüm varyasyonlarında değişir; &ldquo; / &rdquo; sonrası ebat aynen kalır.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
        <label className="space-y-1">
          <span className="font-semibold text-neutral-700">Eski renk</span>
          <select
            aria-label="Eski renk"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              reset();
            }}
            className={input}
          >
            <option value="">Seçin…</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-neutral-700">Yeni renk</span>
          <input
            aria-label="Yeni renk (toplu)"
            list="toplu-renk-oneri"
            value={to}
            maxLength={60}
            onChange={(e) => {
              setTo(e.target.value);
              reset();
            }}
            className={input}
          />
          <datalist id="toplu-renk-oneri">
            {SECENEK_COLOR_ALLOWLIST.map((c) => (
              <option key={c} value={titleTr(c)} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !from || !to.trim()} onClick={() => setPreviewed(true)} className={ghost}>
          <Wand2 size={14} aria-hidden /> Önizle
        </button>
      </div>
      {previewed && !plan.ok && (
        <p role="alert" className="text-red-700 font-semibold" data-testid="toplu-hata">
          {plan.error}
        </p>
      )}
      {previewed && plan.ok && (
        <div className="space-y-2" data-testid="toplu-onizleme">
          <p className="font-semibold text-neutral-800">{plan.value.changes.length} varyasyon değişecek</p>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left">
              <thead className="text-neutral-500">
                <tr>
                  <th scope="col" className="p-2 font-semibold">Eski ad</th>
                  <th scope="col" className="p-2 font-semibold">Yeni ad</th>
                  <th scope="col" className="p-2 font-semibold">Filtre okuması</th>
                </tr>
              </thead>
              <tbody>
                {plan.value.changes.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100 align-top">
                    <td className="p-2 break-words">{c.from}</td>
                    <td className="p-2 break-words font-medium">{c.to}</td>
                    <td className="p-2 text-neutral-600">{readingOf(c.attrs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notes notes={plan.value.notes} />
          <Warnings warnings={warnings} checked={confirm} onChange={setConfirm} />
          <button
            type="button"
            disabled={!canApply}
            onClick={() => save({ productId, bulkColor: { from, to }, confirmWarnings: confirm }, "✓ Renk toplu değiştirildi. Alttaki çubuktan geri alabilirsiniz.")}
            className={primary}
          >
            <Check size={14} aria-hidden /> Uygula
          </button>
        </div>
      )}
    </section>
  );
}
