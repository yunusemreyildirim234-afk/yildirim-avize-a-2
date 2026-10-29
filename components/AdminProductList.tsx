"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";

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
  variations: Variation[];
}

const norm = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

export default function AdminProductList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Ürün adı, stok kodu, barkod veya Trendyol ana kodu ile anlık filtre
  const q = norm(query);
  const filtered = q
    ? products.filter(
        (p) =>
          norm(p.title).includes(q) ||
          norm(p.trendyolMainId).includes(q) ||
          p.variations.some((v) => norm(v.stockCode).includes(q) || norm(v.barcode).includes(q))
      )
    : products;

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
            aria-label="Ürün ismi veya stok kodu ile ara"
            placeholder="Ürün İsmi / Stok Kodu ile Ara"
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

      <div className="divide-y divide-neutral-100">
        {filtered.length === 0 && (
          <p className="p-10 text-center text-xs text-neutral-400">&ldquo;{query}&rdquo; ile eşleşen ürün bulunamadı.</p>
        )}
        {filtered.map((product) => (
          <div key={product.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors">
            {/* Sol: Görsel ve Başlık */}
            <div className="flex items-center gap-4">
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

            {/* Sağ: Ürünü Sil Butonu */}
            <button
              type="button"
              disabled={loadingId === product.id}
              onClick={() => handleDeleteProduct(product.id, product.title)}
              className="text-neutral-400 hover:text-red-600 text-xs font-medium p-2 rounded-lg hover:bg-red-50 transition-colors self-end md:self-center"
              title="Avizeyi Katalogdan Sil"
            >
              🗑️ Modeli Sil
            </button>
          </div>
        ))}
      </div>
      </div>
      )}
    </div>
  );
}