"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Decision, Group, Mode, Settings, Val } from "@/lib/trendyol-plan";

const ROWS: { group: Group; label: string }[] = [
  { group: "STOCK", label: "Stok" },
  { group: "PRICE", label: "Fiyat (satış, liste, varyasyon farkı)" },
  { group: "TEXT", label: "Başlık ve açıklama" },
  { group: "IMAGES", label: "Görseller" },
  { group: "CATEGORY", label: "Kategori ve marka" },
  { group: "VARIANT_INFO", label: "Varyasyon adı ve stok kodu" },
  { group: "ACTIVE", label: "Aktif/pasif (Trendyol'dan kalkanlar)" },
];
const MODES: { mode: Mode; label: string }[] = [
  { mode: "SKIP", label: "Dokunma" },
  { mode: "KEEP", label: "Elle değiştirdiklerimi koru" },
  { mode: "OVERWRITE", label: "Ezerek" },
];
const allOf = (m: Mode): Settings => ({ STOCK: m, PRICE: m, TEXT: m, IMAGES: m, CATEGORY: m, VARIANT_INFO: m, ACTIVE: m });
const STOCK_ONLY: Settings = { ...allOf("SKIP"), STOCK: "OVERWRITE" };

interface FieldView { alan: string; grup: Group; simdiki: Val; trendyol: Val; karar: Decision; elleDegisti: boolean }
interface ProductView {
  mainId: string;
  title: string;
  yeni: boolean;
  kalkan: boolean;
  yeniVaryasyon: number;
  kalkanVaryasyon: number;
  fields: FieldView[];
  variations: { barcode: string; fields: FieldView[] }[];
}
interface Preview {
  sayac: { ezilecek: number; korunacak: number; atlandi: number; yeniUrun: number; yeniVaryasyon: number; pasifeAlinacak: number; degisenUrun: number };
  toplamUrun: number;
  urunler: ProductView[];
}
interface Result { guncellenenUrun: number; yeniUrun: number; yeniVaryasyon: number; stokGuncellenen: number; atlanan: number; hata: number }

const show = (v: Val) => (v === null ? "—" : Array.isArray(v) ? `${v.length} görsel` : String(v));
const badge: Record<Decision, string> = {
  "EZİLECEK": "bg-red-100 text-red-800",
  KORUNACAK: "bg-emerald-100 text-emerald-800",
  AYNI: "bg-neutral-100 text-neutral-700",
  ATLANDI: "bg-neutral-100 text-neutral-500",
};

async function call(body: object) {
  const res = await fetch("/api/admin/trendyol/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
  return data;
}

export default function AdminTrendyolSync() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(allOf("KEEP"));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewSettings, setPreviewSettings] = useState<Settings | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const stale = preview !== null && JSON.stringify(previewSettings) !== JSON.stringify(settings);

  const onPreview = async () => {
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      const data = await call({ ayarlar: settings, dryRun: true });
      const p: Preview = data.plan;
      setPreview(p);
      setPreviewSettings(settings);
      setChecked(new Set(p.urunler.map((u) => u.mainId)));
      setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const overwriteStats = () => {
    if (!preview) return { fields: 0, products: 0 };
    let fields = 0;
    let products = 0;
    for (const u of preview.urunler) {
      if (!checked.has(u.mainId)) continue;
      const all = [...u.fields, ...u.variations.flatMap((v) => v.fields)];
      const n = all.filter((f) => f.karar === "EZİLECEK" && settings[f.grup] === "OVERWRITE").length;
      fields += n;
      if (n > 0) products++;
    }
    return { fields, products };
  };

  const onApply = async () => {
    if (!preview || stale) return;
    const listed = preview.urunler.length;
    const everything = checked.size === listed && preview.toplamUrun > listed; // listelenmeyenler de dahil tümü
    const count = everything ? preview.toplamUrun : checked.size;
    const hasOverwrite = Object.values(settings).includes("OVERWRITE");
    const st = overwriteStats();
    let msg = `${count} ürün Trendyol'a göre güncellenecek.${everything ? " (Listede gösterilmeyen ürünler de dahil.)" : ""}`;
    if (hasOverwrite) msg += `\n\nBu işlem elle yaptığınız değişiklikleri ezer; Geri Al yoktur.\nEzilecek: ${st.fields} alan, ${st.products} ürün (yalnızca listelenenler).`;
    else msg += "\n\nGeri Al yoktur.";
    if (!window.confirm(msg)) return;
    setBusy("apply");
    setError("");
    try {
      const data = await call({ ayarlar: settings, dryRun: false, seciliUrunler: everything ? undefined : [...checked] });
      setResult(data.sonuc);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const detail = (fs: FieldView[], label?: string) =>
    fs.map((f) => (
      <li key={`${label ?? ""}${f.alan}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span className="font-semibold text-neutral-700">{label ? `${label} · ` : ""}{f.alan}</span>
        <span className="text-neutral-500 break-all">{show(f.simdiki)} → {show(f.trendyol)}</span>
        <span className={`px-1.5 py-0.5 rounded font-bold ${badge[f.karar]}`}>{f.karar}</span>
        {f.elleDegisti && <span className="text-amber-700">elle değiştirilmiş</span>}
      </li>
    ));

  return (
    <section aria-labelledby="ty-title" className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 sm:p-5 space-y-4 shadow-sm">
      <div>
        <h2 id="ty-title" className="text-sm font-bold text-neutral-900">Trendyol Ürünleri</h2>
        <p className="text-xs text-neutral-600 mt-0.5">Önce &quot;Önizle&quot; ile değişecekleri görün, sonra seçtiklerinizi uygulayın. Önizleme hiçbir şey yazmaz. Bu sürümde Geri Al yoktur.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-neutral-800 mb-1">Ne güncellensin?</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-xs bg-white border border-neutral-200 rounded-xl">
            <thead>
              <tr className="text-left text-neutral-500">
                <th scope="col" className="p-2 font-semibold">Alan</th>
                {MODES.map((m) => <th key={m.mode} scope="col" className="p-2 font-semibold text-center">{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.group} className="border-t border-neutral-100">
                  <th scope="row" className="p-2 font-medium text-left text-neutral-800">{r.label}</th>
                  {MODES.map((m) => (
                    <td key={m.mode} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`ty-${r.group}`}
                        aria-label={`${r.label}: ${m.label}`}
                        checked={settings[r.group] === m.mode}
                        onChange={() => setSettings((s) => ({ ...s, [r.group]: m.mode }))}
                        className="w-4 h-4 accent-amber-600"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSettings(STOCK_ONLY)} className="min-h-11 text-xs font-semibold border border-neutral-300 bg-white hover:border-amber-600 px-4 rounded-xl">
            Yalnızca stok, ezerek
          </button>
          <button type="button" onClick={() => setSettings(allOf("KEEP"))} className="min-h-11 text-xs font-semibold border border-neutral-300 bg-white hover:border-amber-600 px-4 rounded-xl">
            Normal: hepsi, elle değiştirdiklerimi koru
          </button>
        </div>
      </fieldset>

      <button type="button" onClick={onPreview} disabled={busy !== ""} className="min-h-11 text-xs font-semibold bg-neutral-900 hover:bg-amber-600 text-white px-5 rounded-xl transition-colors disabled:opacity-50">
        {busy === "preview" ? "Trendyol okunuyor..." : "Önizle"}
      </button>

      <div role="status" aria-live="polite" className="text-xs">
        {error && <p className="text-red-600 font-semibold">{error}</p>}
        {result && (
          <p className="text-emerald-800 font-semibold">
            Tamamlandı: {result.guncellenenUrun} ürün güncellendi, {result.yeniUrun} yeni ürün, {result.yeniVaryasyon} yeni varyasyon, {result.stokGuncellenen} stok yazıldı, {result.atlanan} atlandı, {result.hata} hata.
          </p>
        )}
      </div>

      {preview && (
        <div className="space-y-3">
          {stale && <p className="text-xs text-amber-800 font-semibold">Ayarlar değişti; uygulamadan önce yeniden önizleyin.</p>}
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[
              ["EZİLECEK", preview.sayac.ezilecek],
              ["KORUNACAK", preview.sayac.korunacak],
              ["Yeni ürün", preview.sayac.yeniUrun],
              ["Yeni varyasyon", preview.sayac.yeniVaryasyon],
              ["Pasife alınacak", preview.sayac.pasifeAlinacak],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-white border border-neutral-200 rounded-xl p-2">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="font-bold text-neutral-900 text-base">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-neutral-800">
              {preview.toplamUrun} üründe değişiklik{preview.toplamUrun > preview.urunler.length ? ` (ilk ${preview.urunler.length} gösteriliyor)` : ""}; {checked.size} seçili
            </span>
            <button type="button" onClick={() => setChecked(new Set(preview.urunler.map((u) => u.mainId)))} className="underline">Tümünü seç</button>
            <button type="button" onClick={() => setChecked(new Set())} className="underline">Tümünü bırak</button>
          </div>

          <ul className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 max-h-[28rem] overflow-y-auto">
            {preview.urunler.map((u) => (
              <li key={u.mainId} className="p-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <input type="checkbox" aria-label={`${u.title} seç`} checked={checked.has(u.mainId)} onChange={() => toggle(u.mainId)} className="w-4 h-4 accent-amber-600 shrink-0" />
                  <button type="button" aria-expanded={open === u.mainId} onClick={() => setOpen(open === u.mainId ? null : u.mainId)} className="flex-1 min-w-0 text-left truncate font-medium text-neutral-900">
                    {u.title}
                  </button>
                  {u.yeni && <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold">YENİ</span>}
                  {u.kalkan && <span className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800 font-bold">TRENDYOL&apos;DA YOK</span>}
                </div>
                {open === u.mainId && (
                  <ul className="mt-2 ml-6 space-y-1">
                    {u.yeni && <li className="text-[11px] text-sky-800">Yeni ürün oluşturulacak ({u.yeniVaryasyon} varyasyon).</li>}
                    {detail(u.fields)}
                    {u.variations.map((v) => detail(v.fields, v.barcode))}
                    {u.yeniVaryasyon > 0 && !u.yeni && <li className="text-[11px] text-sky-800">{u.yeniVaryasyon} yeni varyasyon eklenecek.</li>}
                    {u.kalkanVaryasyon > 0 && <li className="text-[11px] text-neutral-500">{u.kalkanVaryasyon} varyasyon Trendyol&apos;da yok (silinmez).</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <button type="button" onClick={onApply} disabled={busy !== "" || stale || checked.size === 0} className="min-h-11 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-5 rounded-xl transition-colors disabled:opacity-50">
            {busy === "apply" ? "Uygulanıyor..." : "Seçilenleri uygula"}
          </button>
        </div>
      )}
    </section>
  );
}
