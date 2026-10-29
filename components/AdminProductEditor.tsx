"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditorVariation {
  id: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
}

export interface EditorProduct {
  id: string;
  title: string;
  basePrice: number;
  modelCode?: string | null;
  imageUrl?: string | null;
  images?: string[];
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
export default function AdminProductEditor({ product }: { product: EditorProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(product.title);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [modelCode, setModelCode] = useState(product.modelCode ?? "");
  const [images, setImages] = useState<string[]>(product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []);
  const [newImage, setNewImage] = useState("");

  const [varEdits, setVarEdits] = useState<Record<string, { stock: string; extraPrice: string }>>(
    Object.fromEntries(product.variations.map((v) => [v.id, { stock: String(v.stock), extraPrice: String(v.extraPrice) }]))
  );
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
    run(
      () => api("PATCH", "/api/admin/product", { productId: product.id, title, basePrice: Number(basePrice), modelCode, images }),
      "✓ Ürün bilgileri kaydedildi."
    );

  const saveVariation = (v: EditorVariation) =>
    run(
      () =>
        api("PATCH", "/api/admin/product", {
          variationId: v.id,
          stock: Number(varEdits[v.id].stock),
          extraPrice: Number(varEdits[v.id].extraPrice),
        }),
      "✓ Varyasyon kaydedildi."
    );

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
      })
    );
    setColorName("");
  };

  const addImage = () => {
    const url = newImage.trim();
    if (!/^(https?:\/\/|\/)/.test(url)) return alert("Geçerli bir görsel URL'si girin (https://...).");
    setImages((list) => [...list, url]);
    setNewImage("");
  };

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
      </section>

      {/* Görseller */}
      <section className="space-y-2">
        <h4 className="font-semibold text-neutral-700">Fotoğraflar (ilk görsel ana görsel olur)</h4>
        {images.length === 0 && <p className="text-neutral-400">Görsel yok.</p>}
        <ul className="space-y-2">
          {images.map((url, i) => (
            <li key={i} className="flex items-center gap-2">
              <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-neutral-200 bg-white shrink-0" />
              <input
                aria-label={`Görsel ${i + 1} adresi`}
                value={url}
                onChange={(e) => setImages((list) => list.map((u, j) => (j === i ? e.target.value : u)))}
                className={`${field} flex-1 min-w-0`}
              />
              {i > 0 && (
                <button type="button" onClick={() => setImages((list) => [url, ...list.filter((_, j) => j !== i)])} className="text-amber-700 font-semibold shrink-0">
                  Ana yap
                </button>
              )}
              <button type="button" onClick={() => setImages((list) => list.filter((_, j) => j !== i))} className="text-red-600 font-semibold shrink-0">
                Sil
              </button>
            </li>
          ))}
        </ul>
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
        <ul className="space-y-2">
          {product.variations.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2">
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
        </form>
      </section>
    </div>
  );
}
