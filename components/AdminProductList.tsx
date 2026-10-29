"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminBulkBar from "@/components/AdminBulkBar";
import AdminProductEditor from "@/components/AdminProductEditor";
import { COLLECTION_OPTIONS } from "@/lib/site";

interface Variation {
  id: string;
  variationType: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
  stockCode?: string | null;
  barcode?: string | null;
}

interface Product {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  imageUrl?: string | null;
  trendyolMainId?: string | null;
  modelCode?: string | null;
  images?: string[];
  variations: Variation[];
}

function ModelCodeEditor({ initial, disabled, onSave }: { initial: string; disabled: boolean; onSave: (code: string) => void }) {
  const [value, setValue] = useState(initial);
  const dirty = value.trim() !== initial;
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="text-[10px] font-semibold text-neutral-500">Site Model Kodu</span>
      <input
        aria-label="Site Model Kodu"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 text-[11px] font-mono px-2 py-1 rounded-md border border-neutral-300 focus:outline-none focus:border-amber-600"
      />
      {dirty && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(value)}
          className="text-[10px] font-semibold bg-neutral-900 hover:bg-amber-600 text-white px-2 py-1 rounded-md disabled:opacity-50"
        >
          Kaydet
        </button>
      )}
    </div>
  );
}

const norm = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

export default function AdminProductList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  // Ürün adı, stok kodu, barkod veya Trendyol ana kodu ile anlık filtre
  const q = norm(query);
  const filtered = q
    ? products.filter(
        (p) =>
          norm(p.title).includes(q) ||
          norm(p.modelCode) === q ||
          norm(p.trendyolMainId).includes(q) ||
          p.variations.some((v) => norm(v.stockCode).includes(q) || norm(v.barcode).includes(q))
      )
    : products;

  const defaultCollections: string[] = COLLECTION_OPTIONS.map((c) => c.value);
  const extraCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))].filter((c) => c && !defaultCollections.includes(c)).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });

  // Stok Artır / Azalt
  const handleStockChange = async (variationId: string, newStock: number) => {
    setLoadingId(variationId);
    try {
      const res = await fetch("/api/admin/product", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variationId, stock: newStock }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        alert("Stok güncellenemedi: " + data.error);
      }
    } catch {
      alert("İşlem tamamlanamadı.");
    } finally {
      setLoadingId(null);
    }
  };

  // Site model kodunu kaydet
  const handleModelCodeSave = async (productId: string, modelCode: string) => {
    setLoadingId(productId);
    try {
      const res = await fetch("/api/admin/product", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, modelCode }),
      });
      const data = await res.json();
      if (data.success) router.refresh();
      else alert("Model kodu kaydedilemedi: " + data.error);
    } catch {
      alert("İşlem tamamlanamadı.");
    } finally {
      setLoadingId(null);
    }
  };

  // Ürünü Sil
  const handleDeleteProduct = async (productId: string, title: string) => {
    if (!confirm(`"${title}" modelini katalogdan tamamen silmek istediğinize emin misiniz?`)) {
      return;
    }

    setLoadingId(productId);
    try {
      const res = await fetch("/api/admin/product", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✓ Avize katalogdan silindi.");
        router.refresh();
      } else {
        alert("Silinemedi: " + data.error);
      }
    } catch {
      alert("İşlem tamamlanamadı.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-product-panel"
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900">
            Tüm Ürünler • Avize Kataloğu & Stok Yönetimi
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Mevcut avizelerin varyasyon stoklarını canlı artırıp azaltabilir veya modeli silebilirsiniz.
          </p>
        </div>
        <span className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg">
            Toplam {products.length} Model
          </span>
          <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
      <div id="admin-product-panel" className="border-t border-neutral-100">
      <div className="p-4 sm:px-6 border-b border-neutral-100 bg-neutral-50/60">
        <div className="relative">
          <Search aria-hidden="true" className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Ürün ismi, stok kodu veya model kodu ile ara"
            placeholder="Ürün İsmi / Stok Kodu / Model Kodu ile Ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600"
          />
        </div>
        {q && (
          <p className="text-[11px] text-neutral-500 mt-2">
            {filtered.length} / {products.length} model gösteriliyor
          </p>
        )}
      </div>

      {selected.size > 0 && (
        <AdminBulkBar ids={[...selected]} extraCategories={extraCategories} onDone={() => setSelected(new Set())} />
      )}

      {filtered.length > 0 && (
        <label className="flex items-center gap-2 px-5 sm:px-6 py-2.5 border-b border-neutral-100 text-xs font-semibold text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="w-4 h-4 accent-amber-600" />
          Tümünü Seç ({filtered.length})
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-amber-700 hover:underline">
              Seçimi temizle
            </button>
          )}
        </label>
      )}

      <div className="divide-y divide-neutral-100">
        {filtered.length === 0 && (
          <p className="p-10 text-center text-xs text-neutral-400">&ldquo;{query}&rdquo; ile eşleşen ürün bulunamadı.</p>
        )}
        {filtered.map((product) => (
          <div key={product.id}>
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors">
            {/* Sol: Seçim, Görsel ve Başlık */}
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                aria-label={`${product.title} seç`}
                checked={selected.has(product.id)}
                onChange={() => toggleOne(product.id)}
                className="w-4 h-4 accent-amber-600 shrink-0"
              />
              <div className="w-16 h-16 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-neutral-200">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs font-serif">💡</div>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  {product.category}
                </span>
                <h3 className="font-serif font-bold text-neutral-900 text-sm mt-0.5">
                  {product.title}
                </h3>
                <span className="text-xs font-semibold text-neutral-600">
                  {product.basePrice.toLocaleString("tr-TR")} ₺
                </span>
                <ModelCodeEditor
                  key={`${product.id}-${product.modelCode ?? ""}`}
                  initial={product.modelCode ?? ""}
                  disabled={loadingId === product.id}
                  onSave={(code) => handleModelCodeSave(product.id, code)}
                />
              </div>
            </div>

            {/* Orta: Varyasyonlar ve Stok Butonları */}
            <div className="flex flex-wrap items-center gap-3">
              {product.variations.map((v) => (
                <div key={v.id} className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs shadow-2xs">
                  <div>
                    <span className="font-medium text-neutral-700 block text-[11px]">{v.variationValue}</span>
                    <span className="text-[10px] text-neutral-400">Stok: <strong className="text-neutral-900">{v.stock}</strong></span>
                  </div>

                  <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      disabled={loadingId === v.id || v.stock <= 0}
                      onClick={() => handleStockChange(v.id, v.stock - 1)}
                      aria-label={`${v.variationValue} stoğunu azalt`}
                      className="px-2 py-0.5 hover:bg-neutral-100 text-neutral-600 font-bold disabled:opacity-40"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === v.id}
                      onClick={() => handleStockChange(v.id, v.stock + 1)}
                      aria-label={`${v.variationValue} stoğunu artır`}
                      className="px-2 py-0.5 hover:bg-neutral-100 text-neutral-600 font-bold disabled:opacity-40 border-l border-neutral-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sağ: Düzenle ve Sil */}
            <div className="flex items-center gap-1 self-end md:self-center">
            <button
              type="button"
              onClick={() => setEditingId((id) => (id === product.id ? null : product.id))}
              aria-expanded={editingId === product.id}
              className="text-neutral-600 hover:text-amber-700 text-xs font-medium p-2 rounded-lg hover:bg-amber-50 transition-colors"
            >
              ✏️ {editingId === product.id ? "Kapat" : "Düzenle"}
            </button>
            <button
              type="button"
              disabled={loadingId === product.id}
              onClick={() => handleDeleteProduct(product.id, product.title)}
              className="text-neutral-400 hover:text-red-600 text-xs font-medium p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Avizeyi Katalogdan Sil"
            >
              🗑️ Modeli Sil
            </button>
            </div>
          </div>
          {editingId === product.id && (
            <AdminProductEditor
              key={`${product.id}:${product.variations.map((v) => `${v.id}${v.stock}${v.extraPrice}`).join("|")}`}
              product={product}
            />
          )}
          </div>
        ))}
      </div>
      </div>
      )}
    </div>
  );
}