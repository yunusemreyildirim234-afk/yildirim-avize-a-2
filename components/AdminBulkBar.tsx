"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLLECTION_OPTIONS } from "@/lib/site";

type Tab = "stock" | "rename" | "color" | "collection" | "discount" | "showcase";
type DiscountMode = "PERCENT" | "FIXED" | "QTY_PERCENT" | "QTY_FIXED";

const NEW_COLLECTION = "__new__";
const TABS: { id: Tab; label: string }[] = [
  { id: "stock", label: "Stok" },
  { id: "rename", label: "İsim" },
  { id: "color", label: "Renk Ekle" },
  { id: "collection", label: "Koleksiyon" },
  { id: "discount", label: "İndirim" },
  { id: "showcase", label: "Vitrin" },
];

interface Props {
  ids: string[];
  extraCategories: string[]; // varsayılan listede olmayan mevcut koleksiyonlar
  onDone: () => void;
}

// Seçili ürünler için toplu işlem çubuğu
export default function AdminBulkBar({ ids, extraCategories, onDone }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("stock");
  const [busy, setBusy] = useState(false);

  const [stockMode, setStockMode] = useState<"set" | "add">("set");
  const [stockValue, setStockValue] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorStock, setColorStock] = useState("10");
  const [colorExtra, setColorExtra] = useState("0");
  const [collection, setCollection] = useState<string>(COLLECTION_OPTIONS[0].value);
  const [newCollection, setNewCollection] = useState("");
  const [discMode, setDiscMode] = useState<DiscountMode>("PERCENT");
  const [discValue, setDiscValue] = useState("10");
  const [minQty, setMinQty] = useState("2");
  const [showField, setShowField] = useState<"isFeatured" | "isBestSeller">("isFeatured");
  const [showValue, setShowValue] = useState(true);

  const run = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/product/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "İşlem başarısız.");
        return;
      }
      const skipped = data.skipped ? ` (${data.skipped} üründe ${payload.action === "addVariation" ? "bu renk zaten vardı" : "değişiklik gerekmedi"}, atlandı)` : "";
      alert(`✓ ${ids.length} ürün seçili, işlem uygulandı${skipped}.`);
      router.refresh();
      onDone();
    } catch {
      alert("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "stock") return run({ action: "stock", mode: stockMode, value: Number(stockValue) });
    if (tab === "rename") return run({ action: "rename", prefix, suffix });
    if (tab === "color") {
      return run({ action: "addVariation", variationValue: colorName, stock: Number(colorStock), extraPrice: Number(colorExtra) });
    }
    if (tab === "discount") {
      const value = Number(discValue);
      if (discMode === "PERCENT" || discMode === "FIXED") return run({ action: "discount", mode: discMode, value });
      return run({ action: "bulkQty", type: discMode === "QTY_PERCENT" ? "PERCENT" : "FIXED", minQty: Number(minQty), value });
    }
    if (tab === "showcase") return run({ action: "showcase", field: showField, value: showValue });
    const category = collection === NEW_COLLECTION ? newCollection.trim() : collection;
    if (!category) return alert("Yeni koleksiyon adını yazın.");
    return run({ action: "category", category });
  };

  const removeAll = (action: "removeDiscount" | "removeBulkQty", msg: string) => {
    if (confirm(msg)) run({ action });
  };

  const input = "p-2 rounded-lg border border-neutral-300 bg-white text-xs focus:outline-none focus:border-amber-600";

  return (
    <div className="sticky top-0 z-10 bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <strong className="text-amber-950 mr-2">{ids.length} ürün seçili</strong>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full font-semibold border transition-colors ${
              tab === t.id ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-300 hover:border-amber-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 text-xs">
        {tab === "stock" && (
          <>
            <select aria-label="Stok işlemi" value={stockMode} onChange={(e) => setStockMode(e.target.value as "set" | "add")} className={input}>
              <option value="set">Hepsine aynı stoğu ata</option>
              <option value="add">Mevcut stoğa ekle / çıkar (−5 gibi)</option>
            </select>
            <input aria-label="Stok miktarı" type="number" value={stockValue} onChange={(e) => setStockValue(e.target.value)} className={`${input} w-24`} />
          </>
        )}

        {tab === "rename" && (
          <>
            <input aria-label="Ön ek" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Ön ek (başa eklenir)" className={`${input} w-44`} />
            <input aria-label="Son ek" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Son ek (sona eklenir)" className={`${input} w-44`} />
          </>
        )}

        {tab === "color" && (
          <>
            <input aria-label="Renk adı" required value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="Renk (örn: Krom)" className={`${input} w-40`} />
            <input aria-label="Stok" type="number" min={0} value={colorStock} onChange={(e) => setColorStock(e.target.value)} className={`${input} w-20`} title="Stok" />
            <input aria-label="Ek fiyat" type="number" min={0} value={colorExtra} onChange={(e) => setColorExtra(e.target.value)} className={`${input} w-24`} title="Ek fiyat (₺)" />
          </>
        )}

        {tab === "discount" && (
          <>
            <select aria-label="İndirim türü" value={discMode} onChange={(e) => setDiscMode(e.target.value as DiscountMode)} className={input}>
              <option value="PERCENT">Yüzde indirim (%)</option>
              <option value="FIXED">Sabit tutar indirimi (₺)</option>
              <option value="QTY_PERCENT">Adet bazlı: yüzde (%)</option>
              <option value="QTY_FIXED">Adet bazlı: adet başı ₺</option>
            </select>
            {(discMode === "QTY_PERCENT" || discMode === "QTY_FIXED") && (
              <label className="flex items-center gap-1.5 text-neutral-600">
                En az
                <input aria-label="En az adet" type="number" min={2} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={`${input} w-16`} />
                adet
              </label>
            )}
            <input aria-label="İndirim değeri" type="number" min={1} step="any" required value={discValue} onChange={(e) => setDiscValue(e.target.value)} className={`${input} w-24`} />
            <button type="button" disabled={busy} onClick={() => removeAll("removeDiscount", "Seçili ürünlerde indirim kaldırılsın mı? Eski fiyat geri yüklenir; üstü çizili fiyat ve adet indirimi silinir.")} className="px-3 py-2 rounded-lg border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-60">
              İndirimi Kaldır
            </button>
            <button type="button" disabled={busy} onClick={() => removeAll("removeBulkQty", "Seçili ürünlerde adet indirimi kaldırılsın mı?")} className="px-3 py-2 rounded-lg border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-60">
              Adet İndirimini Kaldır
            </button>
          </>
        )}

        {tab === "showcase" && (
          <>
            <select aria-label="Vitrin" value={showField} onChange={(e) => setShowField(e.target.value as "isFeatured" | "isBestSeller")} className={input}>
              <option value="isFeatured">Öne Çıkanlar</option>
              <option value="isBestSeller">Çok Satanlar</option>
            </select>
            <select aria-label="İşlem" value={showValue ? "add" : "remove"} onChange={(e) => setShowValue(e.target.value === "add")} className={input}>
              <option value="add">Vitrine ekle</option>
              <option value="remove">Vitrinden çıkar</option>
            </select>
          </>
        )}

        {tab === "collection" && (
          <>
            <select aria-label="Koleksiyon" value={collection} onChange={(e) => setCollection(e.target.value)} className={input}>
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
              <option value={NEW_COLLECTION}>Yeni Koleksiyon Ekle...</option>
            </select>
            {collection === NEW_COLLECTION && (
              <input
                aria-label="Yeni koleksiyon adı"
                autoFocus
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                placeholder="Yeni koleksiyon adı"
                className={`${input} w-52`}
              />
            )}
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {busy ? "Uygulanıyor..." : `${ids.length} ürüne uygula`}
        </button>
      </form>
    </div>
  );
}
