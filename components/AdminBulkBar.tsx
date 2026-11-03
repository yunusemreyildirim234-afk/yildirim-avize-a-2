"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLLECTION_OPTIONS } from "@/lib/site";

type Tab = "stock" | "rename" | "color" | "collection" | "discount" | "showcase";

const TAB_LABEL: Record<Tab, string> = { stock: "Stok", rename: "İsim değişikliği", color: "Renk ekleme", collection: "Koleksiyon", discount: "İndirim", showcase: "Vitrin" };
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
  /** Seçili ürünlerde tanımlı indirimler (kaldırma menüsü için) */
  scopes: { normal: boolean; tiers: number[] };
  onApplied: (snapshot: unknown, label: string) => void;
  extraCategories: string[]; // varsayılan listede olmayan mevcut koleksiyonlar
  onDone: () => void;
  maxTotalDiscountPct?: number | null; // genel toplam indirim üst sınırı (uyarı için)
}

// Seçili ürünler için toplu işlem çubuğu
export default function AdminBulkBar({ ids, scopes, onApplied, extraCategories, onDone, maxTotalDiscountPct }: Props) {
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
  const [discMode, setDiscMode] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discValue, setDiscValue] = useState("10");
  const [minQty, setMinQty] = useState("1");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [special, setSpecial] = useState(false); // İndirim sekmesinde "Özel İndirimler" bölümü açık mı
  // Özel indirimler
  const [couponOk, setCouponOk] = useState(true);
  const [pickupPct, setPickupPct] = useState("");
  const [transferPct, setTransferPct] = useState("");
  const [allProducts, setAllProducts] = useState(false);
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
      if (data.snapshot) onApplied(data.snapshot, String(payload.label ?? TAB_LABEL[tab]));
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
    if (!confirm(`Bu işlem seçili ${ids.length} ürüne uygulanacak. Devam edilsin mi?`)) return;
    if (tab === "stock") return run({ action: "stock", mode: stockMode, value: Number(stockValue) });
    if (tab === "rename") return run({ action: "rename", prefix, suffix });
    if (tab === "color") {
      return run({ action: "addVariation", variationValue: colorName, stock: Number(colorStock), extraPrice: Number(colorExtra) });
    }
    if (tab === "discount" && special) {
      for (const [label, v] of [["Mağazadan teslim", pickupPct], ["Havale/EFT", transferPct]] as const) {
        if (v.trim() !== "" && !(Number(v) >= 0 && Number(v) <= 100)) return alert(`${label} indirimi 0 ile 100 arasında olmalıdır.`);
      }
      if (allProducts && !confirm("Özel indirim kuralları KATALOGDAKİ TÜM ürünlere uygulanacak. Emin misiniz?")) return;
      return run({ action: "specialDiscount", all: allProducts, couponAllowed: couponOk, pickupPct: pickupPct.trim() === "" ? null : Number(pickupPct), transferPct: transferPct.trim() === "" ? null : Number(transferPct), label: "Özel indirim kuralı" });
    }
    if (tab === "discount") {
      const value = Number(discValue);
      const qty = Math.floor(Number(minQty));
      if (!(qty >= 1)) return alert("Adet en az 1 olmalıdır.");
      // Adet 1: normal indirim (eski fiyat korunur); 2 ve üzeri: adet kademesi eklenir/güncellenir
      if (qty === 1) return run({ action: "discount", mode: discMode, value, label: "İndirim uygulama" });
      return run({ action: "tier", type: discMode, minQty: qty, value, label: `${qty}+ adet kademesi` });
    }
    if (tab === "showcase") return run({ action: "showcase", field: showField, value: showValue });
    const category = collection === NEW_COLLECTION ? newCollection.trim() : collection;
    if (!category) return alert("Yeni koleksiyon adını yazın.");
    return run({ action: "category", category });
  };

  const removeScope = (payload: Record<string, unknown>, msg: string) => {
    setRemoveOpen(false);
    if (confirm(`${msg}

Etkilenecek ürün sayısı: ${ids.length}`)) run({ action: "removeDiscount", label: "İndirim kaldırma", ...payload });
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
          <div className="basis-full flex items-center gap-2 text-neutral-600">
            <button type="button" aria-pressed={!special} onClick={() => setSpecial(false)} className={`px-3 py-1 rounded-full border text-[11px] font-semibold ${!special ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-300"}`}>
              Fiyat / Adet İndirimi
            </button>
            <button type="button" aria-pressed={special} onClick={() => setSpecial(true)} className={`px-3 py-1 rounded-full border text-[11px] font-semibold ${special ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-300"}`}>
              Özel İndirimler
            </button>
          </div>
        )}

        {tab === "discount" && special && (
          <>
            <label className="flex items-center gap-1.5 text-neutral-700 font-semibold">
              <input type="checkbox" checked={couponOk} onChange={(e) => setCouponOk(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              Kupon geçerli
            </label>
            <label className="flex items-center gap-1.5 text-neutral-600">
              Mağazadan teslim %
              <input aria-label="Mağazadan teslim indirimi yüzdesi" type="number" min={0} max={100} step="any" placeholder="varsayılan" value={pickupPct} onChange={(e) => setPickupPct(e.target.value)} className={`${input} w-24`} />
            </label>
            <label className="flex items-center gap-1.5 text-neutral-600">
              Havale/EFT %
              <input aria-label="Havale EFT indirimi yüzdesi" type="number" min={0} max={100} step="any" placeholder="varsayılan" value={transferPct} onChange={(e) => setTransferPct(e.target.value)} className={`${input} w-24`} />
            </label>
            <label className="flex items-center gap-1.5 text-neutral-600">
              <input type="checkbox" checked={allProducts} onChange={(e) => setAllProducts(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              Tüm ürünler
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm(allProducts ? "Varsayılana dönüş KATALOGDAKİ TÜM ürünlere uygulanacak. Emin misiniz?" : `Varsayılana dönüş seçili ${ids.length} ürüne uygulanacak. Devam edilsin mi?`)) return;
                run({ action: "specialDiscount", all: allProducts, reset: true, label: "Varsayılana dönüş" });
              }}
              className="px-3 py-2 rounded-lg border border-neutral-300 font-semibold hover:bg-neutral-100 disabled:opacity-60"
            >
              Varsayılana dön
            </button>
            <span className="basis-full text-[11px] text-neutral-500">Boş oran = varsayılan (Mağaza %3, Havale %5); 0 = bu üründe indirim yok. Kupon tiki kalkarsa kod bu üründe geçmez.</span>
          </>
        )}

        {tab === "discount" && !special && (
          <>
            <select aria-label="İndirim türü" value={discMode} onChange={(e) => setDiscMode(e.target.value as "PERCENT" | "FIXED")} className={input}>
              <option value="PERCENT">Yüzde (%)</option>
              <option value="FIXED">Tutar (₺)</option>
            </select>
            <label className="flex items-center gap-1.5 text-neutral-600">
              Adet (En az):
              <input aria-label="Adet (en az)" type="number" min={1} step={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={`${input} w-16`} />
            </label>
            <input aria-label="İndirim değeri" type="number" min={1} step="any" required value={discValue} onChange={(e) => setDiscValue(e.target.value)} className={`${input} w-24`} />
            {maxTotalDiscountPct != null && Number(minQty) >= 2 && discMode === "PERCENT" && Number(discValue) >= maxTotalDiscountPct && (
              <span role="alert" className="basis-full text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                Bu kademe genel üst sınırı aşıyor; bu üründe kupon, mağaza ve Havale indirimleri uygulanmaz.
              </span>
            )}
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
        {tab === "discount" && !special && (
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              aria-expanded={removeOpen}
              onClick={() => setRemoveOpen((o) => !o)}
              className="px-3 py-2 rounded-lg border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-60"
            >
              İndirim Kaldır ▾
            </button>
            {removeOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-neutral-200 bg-white shadow-xl p-1.5 space-y-0.5">
                <button type="button" disabled={!scopes.normal} onClick={() => removeScope({ scope: "normal" }, "Seçili ürünlerde normal (1 adet) indirim kaldırılsın mı? Eski fiyat geri yüklenir.")} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent">
                  Sadece Normal (1 Adet) İndirimini Kaldır
                </button>
                {scopes.tiers.map((q) => (
                  <button key={q} type="button" onClick={() => removeScope({ scope: "tier", minQty: q }, `Seçili ürünlerde ${q}+ adet indirimi kaldırılsın mı?`)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50">
                    {q}+ Adet İndirimini Kaldır
                  </button>
                ))}
                <button type="button" onClick={() => removeScope({ scope: "all" }, "Seçili ürünlerdeki TÜM indirimler (normal ve adet kademeleri) kaldırılsın mı?")} className="w-full text-left px-3 py-2 rounded-lg font-semibold text-red-700 hover:bg-red-50 border-t border-neutral-100">
                  Tüm İndirimleri Kaldır
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
