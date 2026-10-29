"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLLECTION_OPTIONS } from "@/lib/site";

type Tab = "stock" | "rename" | "color" | "collection";

const NEW_COLLECTION = "__new__";
const TABS: { id: Tab; label: string }[] = [
  { id: "stock", label: "Stok" },
  { id: "rename", label: "İsim" },
  { id: "color", label: "Renk Ekle" },
  { id: "collection", label: "Koleksiyon" },
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
      const skipped = data.skipped ? ` (${data.skipped} üründe bu renk zaten vardı, atlandı)` : "";
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
    const category = collection === NEW_COLLECTION ? newCollection.trim() : collection;
    if (!category) return alert("Yeni koleksiyon adını yazın.");
    return run({ action: "category", category });
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
