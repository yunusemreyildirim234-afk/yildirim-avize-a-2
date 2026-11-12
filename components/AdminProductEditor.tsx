"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/ImagePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { itemsFromUrls, newKey, uploadFile, type PickerItem } from "@/lib/client-upload";
import { replaceAt, urlsToAppend } from "@/lib/image-list";
import { MAX_EDIT_IMAGES, MAX_VARIATION_IMAGES } from "@/lib/variation-input";
import { BulkColorChange, VariationNameEdit } from "@/components/VariationNameTools";
import { commitStep, dirtyLabels, dirtyOf, editorStateOf, hasNoUndoParts, isDirty, reconcile, resultSummary, savePlan, validateDirty, type EditorState } from "@/lib/editor-dirty";

export interface EditorVariation {
  id: string;
  variationType?: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
  images?: string[];
}

export interface EditorProduct {
  id: string;
  title: string;
  basePrice: number;
  modelCode?: string | null;
  ebat?: string | null;
  imageUrl?: string | null;
  images?: string[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
  active?: boolean;
  /** Stoksuz olunca vitrinde gösterilmeyecek istisna listesinde mi */
  stocklessHidden?: boolean;
  variations: EditorVariation[];
}

async function api(method: string, url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
  return data;
}

const field = "p-2 rounded-lg border border-neutral-300 bg-white text-xs focus:outline-none focus:border-amber-600";
const srcsOf = (l: PickerItem[]) => l.map((i) => i.src);
const sameSrcs = (l: PickerItem[] | undefined, urls: string[]) => l !== undefined && l.length === urls.length && l.every((i, n) => i.src === urls[n]);
const unsaved = <span className="font-semibold text-amber-800">● Kaydedilmedi</span>;

// Tekil ürün düzenleme: başlık, fiyat, model kodu, renk/stok ve görseller.
// Bekleyen değişiklikler alttaki yapışkan çubuktan "Tümünü kaydet" ile, mevcut iki uca SIRAYLA gönderilir (lib/editor-dirty.ts).
export default function AdminProductEditor({ product, onSaved, onDirtyChange, onSetActive, onSetStocklessHidden, busyActive }: { product: EditorProduct; onSaved?: (snapshots: unknown[]) => void; onDirtyChange?: (dirty: boolean) => void; onSetActive?: (makeActive: boolean) => void; onSetStocklessHidden?: (hidden: boolean) => void; busyActive?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Taban: formun açıldığı andaki / son başarılı kayıttaki değerler (router.refresh ile yenilenen prop'tan bağımsız)
  const server = editorStateOf(product);
  const serverSig = JSON.stringify(server);
  const [base, setBase] = useState(server);
  const [seenSig, setSeenSig] = useState(serverSig);

  const [title, setTitle] = useState(server.info.title);
  const [basePrice, setBasePrice] = useState(server.info.basePrice);
  const [modelCode, setModelCode] = useState(server.info.modelCode);
  const [ebat, setEbat] = useState(server.info.ebat);
  const [images, setImages] = useState<PickerItem[]>(() => itemsFromUrls(server.images));
  const [newImage, setNewImage] = useState("");
  const [isFeatured, setIsFeatured] = useState(server.info.isFeatured);
  const [isBestSeller, setIsBestSeller] = useState(server.info.isBestSeller);

  const [varEdits, setVarEdits] = useState<Record<string, { stock: string; extraPrice: string }>>(server.vars);
  const [varImages, setVarImages] = useState<Record<string, PickerItem[]>>(() => Object.fromEntries(product.variations.map((v) => [v.id, itemsFromUrls(v.images ?? [])])));
  const [colorOrder, setColorOrder] = useState<string[]>(server.order); // renk sırası (ProductVariation.position)
  const orderedVariations = colorOrder.map((id) => product.variations.find((v) => v.id === id)).filter((v): v is EditorVariation => Boolean(v));
  const moveColor = (i: number, d: -1 | 1) =>
    setColorOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const [newColorImages, setNewColorImages] = useState<PickerItem[]>([]);
  const [colorName, setColorName] = useState("");
  const [colorStock, setColorStock] = useState("10");
  const [colorExtra, setColorExtra] = useState("0");

  const form: EditorState = {
    info: { title, basePrice, modelCode, ebat, isFeatured, isBestSeller },
    images: srcsOf(images),
    vars: varEdits,
    varImages: Object.fromEntries(Object.entries(varImages).map(([id, l]) => [id, srcsOf(l)])),
    order: colorOrder,
  };
  const applyForm = (next: EditorState) => {
    setTitle(next.info.title);
    setBasePrice(next.info.basePrice);
    setModelCode(next.info.modelCode);
    setEbat(next.info.ebat);
    setIsFeatured(next.info.isFeatured);
    setIsBestSeller(next.info.isBestSeller);
    setImages((l) => (sameSrcs(l, next.images) ? l : itemsFromUrls(next.images)));
    setVarEdits(next.vars);
    setVarImages((m) => Object.fromEntries(Object.entries(next.varImages).map(([id, urls]) => [id, sameSrcs(m[id], urls) ? m[id] : itemsFromUrls(urls)])));
    setColorOrder(next.order);
  };
  // Sunucudan yeni ürün verisi geldi (kayıt, renk ekleme/silme, listedeki stok düğmeleri): kirli olmayan parçalar güncellenir, kirli olanlar korunur
  if (serverSig !== seenSig) {
    setSeenSig(serverSig);
    const r = reconcile(base, form, server);
    setBase(r.base);
    applyForm(r.form);
  }

  const d = dirtyOf(base, form);
  const dirty = isDirty(d);
  const nameOf = (id: string) => product.variations.find((v) => v.id === id)?.variationValue ?? "Renk";
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // Kaydedilmemiş değişiklik varken sekmeyi kapatma/yenileme uyarısı
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Hemen uygulanan işlemler (renk ekle/sil, ad düzenleme): sonuç pencereyle bildirilir
  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) alert(okMsg);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // "Tümünü kaydet": kirli parçalar sırayla gönderilir. Atomik değildir: başarısız parça kirli kalır ve hatası gösterilir; başarılılar tabana işlenir.
  const saveAll = async () => {
    const invalid = validateDirty(form, d, nameOf);
    if (invalid.length) return setResult({ ok: false, text: invalid.join(" ") });
    const sent = form;
    const steps = savePlan(product.id, base, sent, nameOf);
    if (steps.length === 0) return;
    setBusy(true);
    setResult(null);
    setErrors({});
    let b = base;
    let ok = 0;
    const failed: { label: string; error: string }[] = [];
    const errs: Record<string, string> = {};
    const snapshots: unknown[] = [];
    for (const [i, s] of steps.entries()) {
      setProgress({ done: i, total: steps.length });
      try {
        const data = await api(s.method, s.url, s.body);
        if (data.snapshot) snapshots.push(data.snapshot);
        b = commitStep(b, sent, s);
        setBase(b);
        ok++;
      } catch (err) {
        const error = (err as Error).message;
        failed.push({ label: s.label, error });
        errs[s.key] = error;
      }
    }
    setProgress(null);
    setErrors(errs);
    setResult({ ok: failed.length === 0, text: `${resultSummary(ok, failed)}${snapshots.length ? " Alttaki çubuktan geri alabilirsiniz." : ""}` });
    if (snapshots.length) onSaved?.(snapshots); // kayıt sırasıyla; Geri Al ters sırayla uygular
    router.refresh(); // başarısız olsa da: güncel stok satırda görünsün
    setBusy(false);
  };

  const [askDiscard, setAskDiscard] = useState(false); // "Değişiklikleri at" sayfa içi onayı
  const discardAll = () => {
    setAskDiscard(false);
    setBase(server);
    applyForm(server);
    setResult(null);
    setErrors({});
  };

  // Arada stok değiştiyse (kayıt reddedildi): satır güncel stoğu alır, taban da güncellenir
  const takeLiveStock = (v: EditorVariation) => {
    const stock = String(v.stock);
    setBase((b) => ({ ...b, vars: { ...b.vars, [v.id]: { ...b.vars[v.id], stock } } }));
    setVarEdits((m) => ({ ...m, [v.id]: { ...m[v.id], stock } }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== `var:${v.id}`)));
  };

  // Ad düzenleme / toplu renk: sunucu yanıtındaki Geri Al kaydı alttaki çubuğa iletilir
  const saveName = (body: Record<string, unknown>, okMsg: string) =>
    run(async () => {
      const data = await api("PATCH", "/api/admin/product/variation", body);
      if (data.snapshot) onSaved?.([data.snapshot]);
    }, okMsg);

  const deleteVariation = (v: EditorVariation) => {
    if (!confirm(`"${v.variationValue}" rengi silinsin mi?`)) return;
    return run(() => api("DELETE", "/api/admin/product/variation", { variationId: v.id }));
  };

  const addVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(() =>
      api("POST", "/api/admin/product/variation", {
        productId: product.id,
        variationValue: colorName,
        stock: Number(colorStock),
        extraPrice: Number(colorExtra),
        images: newColorImages.map((i) => i.src),
      })
    );
    setColorName("");
    setNewColorImages([]);
  };

  const addImage = () => {
    const url = newImage.trim();
    if (!/^(https:\/\/|\/(?!\/))/.test(url)) return alert("Geçerli bir görsel URL'si girin (https://...).");
    setImages((list) => (list.length >= MAX_EDIT_IMAGES ? list : [...list, { key: newKey(), src: url }]));
    setNewImage("");
  };

  // Seçilen dosyalar hemen tek tek yüklenir; yüklenen adres listeye eklenir (kaydedilmezse 24 saat sonra silinir)
  const uploadInto = (set: (fn: (l: PickerItem[]) => PickerItem[]) => void, max: number) => async (files: File[]) => {
    setBusy(true);
    try {
      for (const f of files) {
        const src = await uploadFile(f, product.id);
        set((l) => (l.length >= max ? l : [...l, { key: newKey(), src }]));
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // "Değiştir": yeni görsel Blob'a yüklenir ve AYNI sıradaki görselin yerine konur (eski Blob dosyası silinmez; eski Neon satırı kaydedilince yetim kalırsa temizlenir)
  const replaceIn = (set: (fn: (l: PickerItem[]) => PickerItem[]) => void) => async (index: number, file: File) => {
    setBusy(true);
    try {
      const src = await uploadFile(file, product.id);
      set((l) => (l[index] ? replaceAt(l, index, { ...l[index], src }) : l));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // "Genel galeriden seç": yalnızca yüklenmiş (dosyası bekleyen olmayan) genel fotoğraflar; mevcut adresler kullanılır, yükleme yok
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const galleryUrls = images.filter((i) => !i.file).map((i) => i.src);
  const openPick = (id: string) => {
    setPickFor((cur) => (cur === id ? null : id));
    setPicked([]);
  };
  const togglePick = (src: string) => setPicked((p) => (p.includes(src) ? p.filter((u) => u !== src) : [...p, src]));
  const applyPick = (id: string) => {
    const add = urlsToAppend((varImages[id] ?? []).map((i) => i.src), picked, MAX_VARIATION_IMAGES);
    if (add.length > 0) setVarImages((m) => ({ ...m, [id]: [...(m[id] ?? []), ...itemsFromUrls(add)] }));
    setPickFor(null);
    setPicked([]);
  };

  const rowError = (key: string) =>
    errors[key] ? (
      <p role="alert" className="basis-full font-semibold text-red-800">
        Kaydedilemedi: {errors[key]}
      </p>
    ) : null;

  return (
    <div className="bg-neutral-50 border-t border-neutral-100 p-5 space-y-6 text-xs">
      {/* Temel bilgiler */}
      <section className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
        <label className="space-y-1">
          <span className="font-semibold text-neutral-700">Ürün başlığı</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-neutral-700">Fiyat (₺)</span>
          <input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={`${field} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-neutral-700">Model kodu</span>
          <input value={modelCode} onChange={(e) => setModelCode(e.target.value)} className={`${field} w-full font-mono`} />
        </label>
        <label className="block space-y-1 sm:max-w-xs">
          <span className="font-semibold text-neutral-700">Ebat</span>
          <input aria-label="Ebat" type="text" maxLength={24} placeholder="45 x 25" value={ebat} onChange={(e) => setEbat(e.target.value)} className="w-full p-2 rounded-lg border border-neutral-300 bg-white text-base sm:text-xs focus:outline-none focus:border-amber-600" />
          <span className="block text-[11px] text-neutral-500">Ürünün ebadı (örn. 45 x 25). Boş bırakırsan renk adındaki ebat (örn. Krom / 58 x 58) kullanılır. Filtreleme ve sıralamada kullanılır.</span>
        </label>
      </section>

      {/* Vitrin durumu: aktif yap / pasife al (onaylı, Geri Al'lı; "Tümünü kaydet"ten bağımsız, hemen uygulanır) */}
      {onSetActive && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="durum-bolumu">
          <span className="font-semibold text-neutral-700">
            Durum:{" "}
            <span data-testid="durum-etiketi" className={product.active === false ? "text-red-800" : "text-emerald-800"}>{product.active === false ? "Pasif (vitrinde görünmez)" : "Aktif (vitrinde)"}</span>
          </span>
          <button
            type="button"
            data-testid={product.active === false ? "duzenle-vitrine-al" : "duzenle-pasife-al"}
            disabled={busyActive}
            onClick={() => onSetActive(product.active === false)}
            className="inline-flex min-h-10 items-center rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600"
          >
            {product.active === false ? "Vitrine al (aktif yap)" : "Vitrinden kaldır (pasife al)"}
          </button>
          {onSetStocklessHidden && (
            <label className="basis-full flex items-start gap-2 font-semibold text-neutral-700 cursor-pointer">
              <input type="checkbox" data-testid="stoksuz-gizle" checked={Boolean(product.stocklessHidden)} disabled={busyActive} onChange={(e) => onSetStocklessHidden(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-amber-600" />
              <span>
                Stoksuz olduğunda vitrinde gösterme
                <span className="block font-normal text-[11px] text-neutral-500">Kategori ayarı açık olsa bile bu ürün stoğu bittiğinde vitrinde görünmez (kalıcı kaldırılan ürünler için).</span>
              </span>
            </label>
          )}
        </section>
      )}

      {/* Vitrin */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="w-4 h-4 accent-amber-600" />
          Öne Çıkanlar vitrininde göster
        </label>
        <label className="flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
          <input type="checkbox" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} className="w-4 h-4 accent-amber-600" />
          Çok Satanlar vitrininde göster
        </label>
        <span className="text-neutral-500">{dirty ? "Değişiklikler alttaki “Tümünü kaydet” ile uygulanır." : "Değişiklik yapınca altta “Tümünü kaydet” çıkar."}</span>
      </section>

      {/* Görseller */}
      <section className="space-y-2">
        <h4 className="font-semibold text-neutral-700">Genel fotoğraflar (ilk görsel kapak olur; renk fotoğraflarından bağımsızdır) {d.images && unsaved}</h4>
        <ImagePicker label="Ürün fotoğrafı" items={images} max={MAX_EDIT_IMAGES} disabled={busy} productTitle={title} onReplaceFile={replaceIn(setImages)} onAddFiles={uploadInto(setImages, MAX_EDIT_IMAGES)} onChange={setImages} />
        <div className="flex gap-2">
          <input
            aria-label="Yeni görsel URL"
            value={newImage}
            onChange={(e) => setNewImage(e.target.value)}
            placeholder="https://... görsel adresi"
            className={`${field} flex-1 min-w-0`}
          />
          <button type="button" onClick={addImage} className="bg-white border border-neutral-300 hover:border-amber-600 font-semibold px-3 rounded-lg shrink-0">
            Görsel Ekle
          </button>
        </div>
        {rowError("info")}
      </section>

      {/* Renk / stok */}
      <section className="space-y-2 border-t border-neutral-200 pt-4">
        <h4 className="font-semibold text-neutral-700">Renk varyasyonları</h4>
        {d.order && (
          <p className="flex flex-wrap items-center gap-2 text-amber-900">
            Renk sırası değişti (ilk stoklu renk sitede varsayılan seçilir). {unsaved}
          </p>
        )}
        {rowError("order")}
        <ul className="space-y-2">
          {orderedVariations.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2">
              <span className="flex flex-col">
                <button type="button" disabled={busy || i === 0} onClick={() => moveColor(i, -1)} aria-label={`${v.variationValue} rengini yukarı al`} className="min-w-8 min-h-5 text-[10px] leading-none rounded border border-neutral-300 bg-white disabled:opacity-30">
                  ▲
                </button>
                <button type="button" disabled={busy || i === orderedVariations.length - 1} onClick={() => moveColor(i, 1)} aria-label={`${v.variationValue} rengini aşağı al`} className="min-w-8 min-h-5 text-[10px] leading-none rounded border border-neutral-300 bg-white disabled:opacity-30">
                  ▼
                </button>
              </span>
              <span className="font-medium text-neutral-800 w-40 truncate" title={v.variationValue}>
                {v.variationValue}
              </span>
              <label className="flex items-center gap-1 text-neutral-500">
                Stok
                <input
                  type="number"
                  min={0}
                  aria-label={`${v.variationValue} stok`}
                  value={varEdits[v.id]?.stock ?? ""}
                  onChange={(e) => setVarEdits((m) => ({ ...m, [v.id]: { ...m[v.id], stock: e.target.value } }))}
                  className={`${field} w-20`}
                />
              </label>
              <label className="flex items-center gap-1 text-neutral-500">
                Ek fiyat
                <input
                  type="number"
                  min={0}
                  aria-label={`${v.variationValue} ek fiyat`}
                  value={varEdits[v.id]?.extraPrice ?? ""}
                  onChange={(e) => setVarEdits((m) => ({ ...m, [v.id]: { ...m[v.id], extraPrice: e.target.value } }))}
                  className={`${field} w-24`}
                />
              </label>
              {d.vars.includes(v.id) && unsaved}
              <button type="button" disabled={busy} onClick={() => deleteVariation(v)} className="font-semibold text-red-600 hover:underline">
                Sil
              </button>
              <VariationNameEdit key={v.variationValue} variation={v} siblings={product.variations} productEbat={product.ebat} busy={busy} save={saveName} />
              {rowError(`var:${v.id}`)}
              {d.vars.includes(v.id) && base.vars[v.id] && base.vars[v.id].stock !== String(v.stock) && (
                <p className="basis-full flex flex-wrap items-center gap-2 text-amber-900" data-testid="stok-degisti">
                  Bu rengin stoğu bu sırada değişti: şu an {v.stock}.
                  <button type="button" disabled={busy} onClick={() => takeLiveStock(v)} className="inline-flex min-h-9 items-center rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
                    Güncel stoğu al
                  </button>
                </p>
              )}
              <div className="basis-full space-y-1.5 pl-1">
                <span className="text-neutral-500">Bu renge özel fotoğraflar (en fazla {MAX_VARIATION_IMAGES}) {d.varImages.includes(v.id) && unsaved}</span>
                <ImagePicker
                  label={`${v.variationValue} fotoğrafı`}
                  items={varImages[v.id] ?? []}
                  max={MAX_VARIATION_IMAGES}
                  disabled={busy}
                  productTitle={`${title} ${v.variationValue}`}
                  onReplaceFile={replaceIn((fn) => setVarImages((m) => ({ ...m, [v.id]: fn(m[v.id] ?? []) })))}
                  onAddFiles={uploadInto((fn) => setVarImages((m) => ({ ...m, [v.id]: fn(m[v.id] ?? []) })), MAX_VARIATION_IMAGES)}
                  onChange={(next) => setVarImages((m) => ({ ...m, [v.id]: next }))}
                />
                <button type="button" disabled={busy} onClick={() => openPick(v.id)} aria-expanded={pickFor === v.id} className="font-semibold text-neutral-700 hover:underline mr-3">
                  Genel galeriden seç
                </button>
                {rowError(`varImages:${v.id}`)}
                {pickFor === v.id && (
                  <div className="rounded-lg border border-neutral-200 bg-white p-2 space-y-2" data-testid="gallery-pick">
                    {galleryUrls.length === 0 ? (
                      <p className="text-neutral-500">Genel galeride yüklenmiş fotoğraf yok.</p>
                    ) : (
                      <ul className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {galleryUrls.map((src, gi) => {
                          const has = (varImages[v.id] ?? []).some((i) => i.src === src);
                          const on = picked.includes(src);
                          return (
                            <li key={src}>
                              <button
                                type="button"
                                disabled={has}
                                aria-pressed={on}
                                aria-label={`Genel fotoğraf ${gi + 1}${has ? " (zaten ekli)" : ""}`}
                                onClick={() => togglePick(src)}
                                className={`relative block w-full aspect-square rounded border-2 overflow-hidden ${on ? "border-amber-500" : "border-transparent"} ${has ? "opacity-40 cursor-not-allowed" : "hover:border-amber-300"}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" className="w-full h-full object-contain bg-white" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" disabled={picked.length === 0} onClick={() => applyPick(v.id)} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg">
                        Seçilenleri ekle ({picked.length})
                      </button>
                      <button type="button" onClick={() => setPickFor(null)} className="text-neutral-500 hover:underline">
                        Vazgeç
                      </button>
                      <span className="text-neutral-500">Eklenenler listeye girer; kalıcı olması için alttaki &ldquo;Tümünü kaydet&rdquo;e basın (en fazla {MAX_VARIATION_IMAGES}).</span>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={addVariation} className="flex flex-wrap items-end gap-2 pt-1">
          <input aria-label="Yeni renk" required value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="Yeni renk adı" className={`${field} w-40`} />
          <input aria-label="Stok" type="number" min={0} value={colorStock} onChange={(e) => setColorStock(e.target.value)} title="Stok" className={`${field} w-20`} />
          <input aria-label="Ek fiyat" type="number" min={0} value={colorExtra} onChange={(e) => setColorExtra(e.target.value)} title="Ek fiyat (₺)" className={`${field} w-24`} />
          <button type="submit" disabled={busy} className="bg-white border border-neutral-300 hover:border-amber-600 font-semibold px-3 py-2 rounded-lg">
            Renk Ekle
          </button>
          <span className="text-neutral-500">Renk ekleme ve silme hemen uygulanır.</span>
          <div className="basis-full">
            <ImagePicker label="Yeni renk fotoğrafı" items={newColorImages} max={MAX_VARIATION_IMAGES} disabled={busy} productTitle={title} onReplaceFile={replaceIn(setNewColorImages)} onAddFiles={uploadInto(setNewColorImages, MAX_VARIATION_IMAGES)} onChange={setNewColorImages} />
          </div>
        </form>
      </section>

      <BulkColorChange key={product.variations.map((v) => v.variationValue).join("|")} productId={product.id} variations={product.variations} busy={busy} save={saveName} />

      <ConfirmDialog open={askDiscard} title="Değişiklikler atılsın mı?" confirmLabel="Evet, at" danger onConfirm={discardAll} onCancel={() => setAskDiscard(false)}>
        <p>Kaydedilmemiş değişiklikler silinir; form son kaydedilen duruma döner.</p>
      </ConfirmDialog>

      {/* Yapışkan kayıt çubuğu: kaydedilmemiş parçalar + "Tümünü kaydet"; sonuç ve hatalar burada (pencere açılmaz) */}
      {(dirty || progress || result) && (
        <div data-testid="kayit-cubugu" role="status" aria-live="polite" className="sticky bottom-0 z-30 -mx-5 -mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-300 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="min-w-0 flex-1 basis-60 space-y-0.5">
            {dirty && (
              <p className="font-semibold text-neutral-900" data-testid="kirli-liste">
                Kaydedilmemiş değişiklikler: <span className="font-normal">{dirtyLabels(d).join(", ")}</span>
              </p>
            )}
            {dirty && hasNoUndoParts(d) && <p className="text-neutral-600">Renk fotoğrafları ve renk sırası kaydedildikten sonra geri alınamaz.</p>}
            <p data-testid="kayit-durum" className={`font-semibold break-words ${result && !result.ok ? "text-red-800" : "text-emerald-800"}`}>
              {progress ? `${progress.done + 1}/${progress.total} kaydediliyor...` : (result?.text ?? "")}
            </p>
          </div>
          {dirty ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={() => setAskDiscard(true)} className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600">
                Değişiklikleri at
              </button>
              <button type="button" data-testid="tumunu-kaydet" disabled={busy} onClick={saveAll} className="inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-4 font-semibold text-white hover:bg-amber-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
                Tümünü kaydet
              </button>
            </div>
          ) : (
            !progress && (
              <button type="button" aria-label="Kayıt sonucunu kapat" onClick={() => setResult(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-base text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-amber-600">
                ×
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
