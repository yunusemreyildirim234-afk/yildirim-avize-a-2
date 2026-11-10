"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/ImagePicker";
import { itemsFromUrls, newKey, uploadFile, type PickerItem } from "@/lib/client-upload";
import { replaceAt } from "@/lib/image-list";
import { MAX_EDIT_IMAGES, MAX_VARIATION_IMAGES } from "@/lib/variation-input";
import { BulkColorChange, VariationNameEdit } from "@/components/VariationNameTools";

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

// Tekil ürün düzenleme: başlık, fiyat, model kodu, renk/stok ve görseller
export default function AdminProductEditor({ product, onSaved, onSetActive, onSetStocklessHidden, busyActive }: { product: EditorProduct; onSaved?: (snapshot: unknown) => void; onSetActive?: (makeActive: boolean) => void; onSetStocklessHidden?: (hidden: boolean) => void; busyActive?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(product.title);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [modelCode, setModelCode] = useState(product.modelCode ?? "");
  const [ebat, setEbat] = useState(product.ebat ?? "");
  const [images, setImages] = useState<PickerItem[]>(itemsFromUrls(product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []));
  const [newImage, setNewImage] = useState("");
  const [isFeatured, setIsFeatured] = useState(Boolean(product.isFeatured));
  const [isBestSeller, setIsBestSeller] = useState(Boolean(product.isBestSeller));

  const [varEdits, setVarEdits] = useState<Record<string, { stock: string; extraPrice: string }>>(
    Object.fromEntries(product.variations.map((v) => [v.id, { stock: String(v.stock), extraPrice: String(v.extraPrice) }]))
  );
  const [varImages, setVarImages] = useState<Record<string, PickerItem[]>>(Object.fromEntries(product.variations.map((v) => [v.id, itemsFromUrls(v.images ?? [])])));
  const [colorOrder, setColorOrder] = useState<string[]>(product.variations.map((v) => v.id)); // renk sırası (ProductVariation.position)
  const orderedVariations = colorOrder.map((id) => product.variations.find((v) => v.id === id)).filter((v): v is EditorVariation => Boolean(v));
  const orderDirty = colorOrder.some((id, i) => id !== product.variations[i]?.id);
  const moveColor = (i: number, d: -1 | 1) =>
    setColorOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const saveColorOrder = () => run(() => api("PATCH", "/api/admin/product/variation", { productId: product.id, order: colorOrder }), "✓ Renk sırası kaydedildi.");
  const [newColorImages, setNewColorImages] = useState<PickerItem[]>([]);
  const [colorName, setColorName] = useState("");
  const [colorStock, setColorStock] = useState("10");
  const [colorExtra, setColorExtra] = useState("0");

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

  const saveInfo = () =>
    run(async () => {
      const data = await api("PATCH", "/api/admin/product", { productId: product.id, title, basePrice: Number(basePrice), modelCode, ebat, images: images.map((i) => i.src), isFeatured, isBestSeller });
      onSaved?.(data.snapshot);
    }, "✓ Ürün bilgileri kaydedildi. Alttaki çubuktan geri alabilirsiniz.");

  const saveVariation = (v: EditorVariation) =>
    run(async () => {
      const data = await api("PATCH", "/api/admin/product", {
        variationId: v.id,
        stock: Number(varEdits[v.id].stock),
        prevStock: v.stock, // formun açıldığı andaki stok: sunucu yalnızca bu değer hâlâ geçerliyse yazar
        extraPrice: Number(varEdits[v.id].extraPrice),
      });
      onSaved?.(data.snapshot);
    }, "✓ Varyasyon kaydedildi. Alttaki çubuktan geri alabilirsiniz.");

  // Ad düzenleme / toplu renk: sunucu yanıtındaki Geri Al kaydı alttaki çubuğa iletilir
  const saveName = (body: Record<string, unknown>, okMsg: string) =>
    run(async () => {
      const data = await api("PATCH", "/api/admin/product/variation", body);
      onSaved?.(data.snapshot);
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

  const saveVariationImages = (v: EditorVariation) =>
    run(() => api("PATCH", "/api/admin/product/variation", { variationId: v.id, images: (varImages[v.id] ?? []).map((i) => i.src) }), "✓ Renk fotoğrafları kaydedildi.");

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

      {/* Vitrin durumu: aktif yap / pasife al (onaylı, Geri Al'lı; "Kaydet"ten bağımsız, hemen uygulanır) */}
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
        <span className="text-neutral-400">Değişiklik &ldquo;Kaydet&rdquo; ile uygulanır.</span>
      </section>

      {/* Görseller */}
      <section className="space-y-2">
        <h4 className="font-semibold text-neutral-700">Genel fotoğraflar (ilk görsel kapak olur; renk fotoğraflarından bağımsızdır)</h4>
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
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={saveInfo}
        className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        Bilgileri ve Fotoğrafları Kaydet
      </button>

      {/* Renk / stok */}
      <section className="space-y-2 border-t border-neutral-200 pt-4">
        <h4 className="font-semibold text-neutral-700">Renk varyasyonları</h4>
        {orderDirty && (
          <p className="flex flex-wrap items-center gap-2 text-amber-900">
            Renk sırası değişti (ilk stoklu renk sitede varsayılan seçilir).
            <button type="button" disabled={busy} onClick={saveColorOrder} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-3 py-1.5 rounded-lg">
              Renk Sırasını Kaydet
            </button>
          </p>
        )}
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
                  value={varEdits[v.id]?.extraPrice ?? ""}
                  onChange={(e) => setVarEdits((m) => ({ ...m, [v.id]: { ...m[v.id], extraPrice: e.target.value } }))}
                  className={`${field} w-24`}
                />
              </label>
              <button type="button" disabled={busy} onClick={() => saveVariation(v)} className="font-semibold text-emerald-700 hover:underline">
                Kaydet
              </button>
              <button type="button" disabled={busy} onClick={() => deleteVariation(v)} className="font-semibold text-red-600 hover:underline">
                Sil
              </button>
              <VariationNameEdit variation={v} siblings={product.variations} productEbat={product.ebat} busy={busy} save={saveName} />
              <div className="basis-full space-y-1.5 pl-1">
                <span className="text-neutral-500">Bu renge özel fotoğraflar (en fazla {MAX_VARIATION_IMAGES})</span>
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
                <button type="button" disabled={busy} onClick={() => saveVariationImages(v)} className="font-semibold text-emerald-700 hover:underline">
                  Fotoğrafları Kaydet
                </button>
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
          <div className="basis-full">
            <ImagePicker label="Yeni renk fotoğrafı" items={newColorImages} max={MAX_VARIATION_IMAGES} disabled={busy} productTitle={title} onReplaceFile={replaceIn(setNewColorImages)} onAddFiles={uploadInto(setNewColorImages, MAX_VARIATION_IMAGES)} onChange={setNewColorImages} />
          </div>
        </form>
      </section>

      <BulkColorChange productId={product.id} variations={product.variations} busy={busy} save={saveName} />
    </div>
  );
}
