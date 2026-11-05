"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { useOpenOnHash } from "@/components/useOpenOnHash";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/ImagePicker";
import { discardUploaded, itemsFromFiles, releaseItem, uploadFile, type PickerItem } from "@/lib/client-upload";
import { MAX_PRODUCT_IMAGES, MAX_VARIATIONS, MAX_VARIATION_IMAGES } from "@/lib/variation-input";
import { COLLECTION_OPTIONS } from "@/lib/site";

const NEW_CATEGORY = "__new__";

interface ColorRow {
  key: number;
  name: string;
  stock: string;
  extraPrice: string;
  items: PickerItem[];
}
const firstRow = (): ColorRow => ({ key: 1, name: "Parlak Gold", stock: "10", extraPrice: "0", items: [] });
const field = "w-full p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:border-amber-600 focus-visible:ring-2 focus-visible:ring-amber-600/30";

export default function AdminAddProduct({ extraCategories = [] }: { extraCategories?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useOpenOnHash("yeni-avize", setOpen);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Kristal");
  const [newCategory, setNewCategory] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [photos, setPhotos] = useState<PickerItem[]>([]);
  const [rows, setRows] = useState<ColorRow[]>([firstRow()]);
  const [nextKey, setNextKey] = useState(2);
  const [status, setStatus] = useState("");

  const patchRow = (key: number, patch: Partial<ColorRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setPhotoItems = (next: PickerItem[]) => {
    photos.filter((p) => !next.includes(p)).forEach(releaseItem);
    setPhotos(next);
  };
  const setRowItems = (row: ColorRow, next: PickerItem[]) => {
    row.items.filter((p) => !next.includes(p)).forEach(releaseItem);
    patchRow(row.key, { items: next });
  };
  const addRow = () => {
    if (rows.length >= MAX_VARIATIONS) return;
    setRows((list) => [...list, { key: nextKey, name: "", stock: "10", extraPrice: "0", items: [] }]);
    setNextKey((k) => k + 1);
  };
  const reset = () => {
    photos.forEach(releaseItem);
    rows.forEach((r) => r.items.forEach(releaseItem));
    setTitle("");
    setBasePrice("");
    setNewCategory("");
    setModelCode("");
    setDescription("");
    setPhotos([]);
    setRows([firstRow()]);
    setNextKey(2);
  };

  // Dosyalar yalnızca gönderimde, tek tek yüklenir. Biri başarısız olursa ürün OLUŞTURULMAZ ve o ana dek yüklenenler silinir.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const uploaded: string[] = [];
    try {
      const urlOf = async (it: PickerItem, label: string) => {
        if (!it.file) return it.src;
        setStatus(`${label} yükleniyor...`);
        const url = await uploadFile(it.file);
        uploaded.push(url);
        return url;
      };
      const images: string[] = [];
      for (const it of photos) images.push(await urlOf(it, "Ürün fotoğrafı"));
      const variations = [];
      for (const r of rows) {
        const rowImages: string[] = [];
        for (const it of r.items) rowImages.push(await urlOf(it, `${r.name.trim() || "Renk"} fotoğrafı`));
        variations.push({ name: r.name, stock: r.stock, extraPrice: r.extraPrice, images: rowImages });
      }
      const categoryValue = category === NEW_CATEGORY ? newCategory.trim() : category;
      if (!categoryValue) throw new Error("Yeni kategori adını yazın.");
      setStatus("Ürün kaydediliyor...");
      const res = await fetch("/api/admin/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category: categoryValue, basePrice, description, modelCode, images, variations }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        alert("✓ Yeni avize başarıyla vitrine eklendi!");
        reset();
        setOpen(false);
        router.refresh();
      } else {
        await discardUploaded(uploaded);
        alert("Hata: " + (data.error || "Ürün eklenemedi."));
      }
    } catch (err) {
      await discardUploaded(uploaded);
      alert(err instanceof Error && err.message ? `Hata: ${err.message} Ürün eklenmedi.` : "Bağlantı hatası oluştu. Ürün eklenmedi.");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <div id="yeni-avize" className="scroll-mt-[var(--admin-offset,6rem)] bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <PackagePlus aria-hidden="true" className="w-4 h-4 text-amber-600" /> Hızlı Ürün & Stok Girişi
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Kataloğa yeni avize, renkleri, stokları ve fotoğrafları ekleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          {open ? "Formu Kapat" : "+ Yeni Avize Ekle"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">Avize Adı</label>
            <input aria-label="Avize Adı" required type="text" placeholder="Örn: Çırağan 12'li Sarkıt Avize" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 block mb-1">Kategori</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} bg-white`}>
              {/* Sabit kategoriler (veritabanı değerleri aynen) + yönetim panelinden eklenenler */}
              {COLLECTION_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
              {extraCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>Yeni kategori yaz…</option>
            </select>
            {category === NEW_CATEGORY && (
              <input
                aria-label="Yeni kategori adı"
                autoFocus
                type="text"
                maxLength={60}
                placeholder="Örn: Yemek Masası Üstü Avizeler"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className={`${field} mt-2`}
              />
            )}
            {category === NEW_CATEGORY && <p className="mt-1 text-[11px] text-neutral-500">Ad başlık biçimine çevrilir; mevcut bir kategoriyle yalnızca harf farkı varsa mevcut yazım kullanılır.</p>}
          </div>

          <div>
            <label className="font-semibold text-neutral-700 block mb-1">Taban Satış Fiyatı (₺)</label>
            <input aria-label="Fiyat" required type="number" min={1} step="any" inputMode="decimal" placeholder="Örn: 6500" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={field} />
          </div>

          <div>
            <label className="font-semibold text-neutral-700 block mb-1">Site Model Kodu (boşsa otomatik)</label>
            <input aria-label="Site Model Kodu" type="text" placeholder="Örn: 237" value={modelCode} onChange={(e) => setModelCode(e.target.value)} className={field} />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <span className="font-semibold text-neutral-700 block">Ürün Fotoğrafları (ilk fotoğraf kapak olur, en fazla {MAX_PRODUCT_IMAGES})</span>
            <ImagePicker
              label="Ürün fotoğrafı"
              items={photos}
              max={MAX_PRODUCT_IMAGES}
              disabled={loading}
              onAddFiles={(files) => setPhotos((list) => [...list, ...itemsFromFiles(files)].slice(0, MAX_PRODUCT_IMAGES))}
              onChange={setPhotoItems}
            />
          </div>

          <fieldset className="sm:col-span-2 space-y-3">
            <legend className="font-semibold text-neutral-700 mb-1">Renkler / Varyasyonlar</legend>
            {rows.map((r, idx) => (
              <div key={r.key} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-3">
                <div className="grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_96px_120px_auto] gap-2 items-end">
                  <label className="col-span-2 sm:col-span-1">
                    <span className="block mb-1 text-neutral-600">Renk adı</span>
                    <input required maxLength={60} value={r.name} onChange={(e) => patchRow(r.key, { name: e.target.value })} placeholder="Örn: Eskitme Pirinç" className={field} />
                  </label>
                  <label>
                    <span className="block mb-1 text-neutral-600">Stok (adet)</span>
                    <input required type="number" min={0} max={99999} step={1} inputMode="numeric" value={r.stock} onChange={(e) => patchRow(r.key, { stock: e.target.value })} className={field} />
                  </label>
                  <label>
                    <span className="block mb-1 text-neutral-600">Fiyat farkı (₺)</span>
                    <input type="number" min={0} step="any" inputMode="decimal" value={r.extraPrice} onChange={(e) => patchRow(r.key, { extraPrice: e.target.value })} className={field} />
                  </label>
                  <button
                    type="button"
                    disabled={loading || rows.length === 1}
                    onClick={() => {
                      r.items.forEach(releaseItem);
                      setRows((list) => list.filter((x) => x.key !== r.key));
                    }}
                    aria-label={`${idx + 1}. rengi sil`}
                    className="min-h-10 px-3 rounded-lg border border-red-300 bg-white font-semibold text-red-700 disabled:opacity-30"
                  >
                    Sil
                  </button>
                </div>
                <div>
                  <span className="block mb-1 text-neutral-600">Bu renge özel fotoğraflar (isteğe bağlı, en fazla {MAX_VARIATION_IMAGES})</span>
                  <ImagePicker
                    label={`${r.name || "Renk"} fotoğrafı`}
                    items={r.items}
                    max={MAX_VARIATION_IMAGES}
                    disabled={loading}
                    onAddFiles={(files) => patchRow(r.key, { items: [...r.items, ...itemsFromFiles(files)].slice(0, MAX_VARIATION_IMAGES) })}
                    onChange={(next) => setRowItems(r, next)}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={addRow} disabled={loading || rows.length >= MAX_VARIATIONS} className="min-h-10 rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 disabled:opacity-50">
              + Renk Ekle
            </button>
          </fieldset>

          <div className="sm:col-span-2">
            <label className="font-semibold text-neutral-700 block mb-1">Ürün Açıklaması</label>
            <textarea aria-label="Ürün Açıklaması" rows={2} placeholder="Avizenin materyali, kullanım alanı ve ampul uyumluluğu..." value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </div>

          <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
            {status && <span role="status" className="text-neutral-500">{status}</span>}
            <button type="submit" disabled={loading} className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {loading ? "Kaydediliyor..." : "Avizeyi Vitrinde Yayınla"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}   