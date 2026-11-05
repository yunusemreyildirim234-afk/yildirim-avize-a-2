"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminBulkBar from "@/components/AdminBulkBar";
import AdminSelectionPanel, { scrollToRow } from "@/components/AdminSelectionPanel";
import { addAll, chipLabel, nextLastId, removeAll, removeId, toggleId } from "@/lib/admin-selection";
import AdminProductEditor from "@/components/AdminProductEditor";
import SmartFilterChips from "@/components/SmartFilterChips";
import { bulkTiersOf, tierBadgeLabel, tierValueLabel } from "@/lib/bulk-pricing";
import { CATEGORIES } from "@/lib/site";
import { buildCategoryList, productInCategory } from "@/lib/categories";
import { uncategorizedCount } from "@/lib/category-settings";

const NONE_KEY = "__kategorisiz__"; // "Kategorisiz (N)" çipi
import { coverImageOf } from "@/lib/variation-input";

interface Variation {
  id: string;
  variationType: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
  stockCode?: string | null;
  barcode?: string | null;
  images?: string[];
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
  listPrice?: number | null;
  active?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  couponAllowed?: boolean;
  pickupDiscountPct?: number | null;
  transferDiscountPct?: number | null;
  bulkTiers?: unknown;
  variations: Variation[];
}

// Otomatik indirim: üstü çizili eski fiyat veya adet indirimi
const hasDiscount = (p: Product) => Boolean(p.listPrice && p.listPrice > p.basePrice) || bulkTiersOf(p).length > 0;
// Vitrin çipleri, sitedeki (ana sayfa / kategori) ürün kümesiyle AYNI ürünleri kullanır: sunucu bu kümeleri hesaplayıp kimlik listesi olarak verir
// (yönetici işaretlileri varsa onlar, yoksa otomatik seçim; Çok Satanlar: işaretliler + en çok satılanlar).
type ChipSets = { featured: Set<string>; bestseller: Set<string> };
const chipTest = (key: string, p: Product, sets: ChipSets): boolean =>
  key === "discount" ? hasDiscount(p) : key === "featured" ? sets.featured.has(p.id) : key === "bestseller" ? sets.bestseller.has(p.id) : false;

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

function DiscountBadges({ product, onRemove, disabled }: { product: Product; onRemove: (payload: Record<string, unknown>, label: string) => void; disabled: boolean }) {
  const old = product.listPrice && product.listPrice > product.basePrice ? product.listPrice : null;
  const tiers = bulkTiersOf(product);
  const badge = "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded";
  const x = "ml-0.5 rounded-sm px-1 leading-none hover:bg-black/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-amber-600";
  const hidden = product.active === false && Boolean(old || tiers.length > 0 || product.isFeatured || product.isBestSeller);
  if (!hidden && !old && tiers.length === 0 && !product.isFeatured && !product.isBestSeller && product.couponAllowed !== false && product.pickupDiscountPct == null && product.transferDiscountPct == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {old && (
        <>
          <span className="text-[10px] text-neutral-400 line-through">{old.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
          <span className={`${badge} bg-red-50 text-red-700`}>
            Normal İndirim: %{Math.round((1 - product.basePrice / old) * 100)} (−{(old - product.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺)
            <button type="button" disabled={disabled} aria-label="Normal indirimi kaldır" onClick={() => onRemove({ scope: "normal" }, "Normal indirim kaldırma")} className={x}>
              ×
            </button>
          </span>
        </>
      )}
      {tiers.map((t) => (
        <span key={t.minQty} className={`${badge} bg-amber-100 text-amber-950`} title={tierValueLabel(t)}>
          {tierBadgeLabel(t)}
          <button type="button" disabled={disabled} aria-label={`${t.minQty}+ adet indirimini kaldır`} onClick={() => onRemove({ scope: "tier", minQty: t.minQty }, `${t.minQty}+ adet indirimi kaldırma`)} className={x}>
            ×
          </button>
        </span>
      ))}
      {product.isFeatured && <span className={`${badge} bg-neutral-900 text-white`}>Öne Çıkan</span>}
      {product.couponAllowed === false && <span className={`${badge} bg-zinc-200 text-zinc-800`}>Kupon geçmez</span>}
      {product.pickupDiscountPct != null && <span className={`${badge} bg-zinc-100 text-zinc-800`}>Mağaza %{product.pickupDiscountPct}</span>}
      {product.transferDiscountPct != null && <span className={`${badge} bg-zinc-100 text-zinc-800`}>Havale %{product.transferDiscountPct}</span>}
      {product.isBestSeller && <span className={`${badge} bg-emerald-100 text-emerald-900`}>Çok Satan</span>}
      {hidden && <span className={`${badge} bg-red-100 text-red-800`}>Sitede görünmüyor (pasif)</span>}
    </div>
  );
}

const norm = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

export default function AdminProductList({ products, maxTotalDiscountPct, showcase, extraCategories = [] }: { products: Product[]; maxTotalDiscountPct?: number | null; extraCategories?: string[]; showcase: { featured: string[]; bestSellers: string[]; manualFeatured: number } }) {
  const sets = useMemo<ChipSets>(() => ({ featured: new Set(showcase.featured), bestseller: new Set(showcase.bestSellers) }), [showcase]);
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); // ürün KİMLİKLERİ: süzgeç/arama/sayfalama değişse de korunur
  const [lastId, setLastId] = useState<string | null>(null); // son seçilen ürün ("Seçtiğim yere dön")
  const [flash, setFlash] = useState<string | null>(null); // çipten gidilen satırın kısa vurgusu
  const [notice, setNotice] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [catChips, setCatChips] = useState<string[]>([]); // kategori çipleri (anahtar: categoryKey); diğer çiplerle KESİŞİR
  const PAGE = 8;
  const [shown, setShown] = useState(PAGE); // listede gösterilen ürün sayısı (8'er artar)
  // Son işlem öncesi durum (Geri Al)
  const [undo, setUndo] = useState<{ snapshot: unknown; label: string } | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Tüm elle Öne Çıkan işaretlerini kaldırır (sunucu "zaten bu durumda" kontrolü ve Geri Al kaydı aynı yolu kullanır)
  const backToAuto = async () => {
    if (!confirm("Tüm elle işaretler kaldırılacak; öne çıkanlar otomatik seçime dönecek.")) return;
    try {
      const res = await fetch("/api/admin/product/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: products.filter((p) => p.isFeatured).map((p) => p.id), action: "showcase", field: "isFeatured", value: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      if (data.snapshot) setUndo({ snapshot: data.snapshot, label: "Otomatik seçime dönüş" });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const doUndo = async (force = false) => {
    if (!undo) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/admin/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: undo.snapshot, force }) });
      const data = await res.json().catch(() => ({}));
      // Ürün işlemden sonra başka yerde değiştiyse: kullanıcıya sorulur, onaylarsa zorla geri alınır
      if (res.status === 409 && data.conflict && !force) {
        setUndoing(false);
        if (confirm(`${data.error}

Yine de geri alınsın mı?`)) await doUndo(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Geri alınamadı.");
      setUndo(null);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUndoing(false);
    }
  };

  // Rozet ×: tek ürün için seçici indirim kaldırma
  const removeFromProduct = async (productId: string, payload: Record<string, unknown>, label: string) => {
    setLoadingId(productId);
    try {
      const res = await fetch("/api/admin/product/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [productId], action: "removeDiscount", ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      if (data.snapshot) setUndo({ snapshot: data.snapshot, label });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const scopes = {
    normal: selectedProducts.some((p) => Boolean(p.listPrice && p.listPrice > p.basePrice)),
    tiers: [...new Set(selectedProducts.flatMap((p) => bulkTiersOf(p).map((t) => t.minQty)))].sort((a, b) => a - b),
  };

  // Ürün adı, stok kodu, barkod veya Trendyol ana kodu ile anlık filtre
  const q = norm(query);
  const chipFiltered0 = chips.length ? products.filter((p) => chips.some((c) => chipTest(c, p, sets))) : products;
  // Kategori çipleri: seçili kategorilerden biri (büyük/küçük harf ve boşluk varyantları dahil) VE yukarıdaki vitrin çipleri
  const catEntries = useMemo(() => buildCategoryList(products.map((p) => ({ category: p.category, count: 1 })), CATEGORIES), [products]);
  const selectedCats = catEntries.filter((c) => catChips.includes(c.key));
  const noneCount = uncategorizedCount(products); // kategorisiz ürün sayısı (boş / yalnız boşluk)
  const noneOn = catChips.includes(NONE_KEY);
  const chipFiltered = selectedCats.length || noneOn ? chipFiltered0.filter((p) => (noneOn && !p.category.trim()) || selectedCats.some((c) => productInCategory(p.category, c))) : chipFiltered0;
  const filtered = q
    ? chipFiltered.filter(
        (p) =>
          norm(p.title).includes(q) ||
          norm(p.modelCode) === q ||
          norm(p.trendyolMainId).includes(q) ||
          p.variations.some((v) => norm(v.stockCode).includes(q) || norm(v.barcode).includes(q))
      )
    : chipFiltered;

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleOne = (id: string) => {
    const next = toggleId(selected, id);
    setSelected(next);
    setLastId((prev) => nextLastId(prev, next, id));
  };
  const dropOne = (id: string) => {
    const next = removeId(selected, id);
    setSelected(next);
    setLastId((prev) => nextLastId(prev, next, id));
  };
  const toggleAll = () => setSelected((prev) => (allFilteredSelected ? removeAll(prev, filtered.map((p) => p.id)) : addAll(prev, filtered.map((p) => p.id))));

  // Çip tıklaması: satıra kaydır + kısa vurgu. Satır "Daha fazla göster" ile gizliyse görünür yapılır; süzgeç dışındaysa bilgi verilir.
  const focusProduct = (id: string) => {
    const idx = filtered.findIndex((p) => p.id === id);
    if (idx < 0) {
      setNotice("Bu ürün şu anki arama/filtrede görünmüyor; seçili kalır. Filtreyi temizleyince listede bulunur.");
      return;
    }
    setNotice("");
    if (idx >= shown) setShown(Math.ceil((idx + 1) / PAGE) * PAGE);
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToRow(id)));
    setFlash(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  };
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const chipItems = [...selected].flatMap((id) => {
    const p = byId.get(id);
    return p ? [{ id, label: chipLabel(p.title, p.modelCode) }] : [];
  });

  // Stok Artır / Azalt
  const handleStockChange = async (variationId: string, newStock: number, oldStock: number) => {
    setLoadingId(variationId);
    try {
      const res = await fetch("/api/admin/product", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variationId, stock: newStock }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.snapshot) setUndo({ snapshot: data.snapshot, label: `Stok ${oldStock} → ${newStock}` });
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
      if (data.success) {
        if (data.snapshot) setUndo({ snapshot: data.snapshot, label: "Model kodu değişikliği" });
        router.refresh();
      } else alert("Model kodu kaydedilemedi: " + data.error);
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
        if (data.snapshot) setUndo({ snapshot: data.snapshot, label: `"${title}" silme` });
        alert(data.message ? "ℹ " + data.message : "✓ Avize katalogdan silindi. Aşağıdaki çubuktan geri alabilirsiniz.");
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
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-clip shadow-sm">
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
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-amber-600"
          />
        </div>
        <div className="mt-3">
          <SmartFilterChips
            label="Ürün vitrin ve indirim filtreleri"
            selected={chips}
            onChange={(c) => { setChips(c); setShown(PAGE); }}
            total={products.length}
            options={[
              { key: "discount", label: "İndirimdekiler", count: products.filter((p) => chipTest("discount", p, sets)).length },
              { key: "featured", label: "Öne Çıkanlar", count: products.filter((p) => chipTest("featured", p, sets)).length },
              { key: "bestseller", label: "Çok Satanlar", count: products.filter((p) => chipTest("bestseller", p, sets)).length },
            ]}
          />
          <div className="mt-2">
            <SmartFilterChips
              label="Ürün kategori filtreleri"
              selected={catChips}
              onChange={(c) => { setCatChips(c); setShown(PAGE); }}
              total={products.length}
              allLabel="Tüm kategoriler"
              options={[...catEntries.filter((c) => c.count > 0).map((c) => ({ key: c.key, label: c.title, count: c.count })), ...(noneCount > 0 ? [{ key: NONE_KEY, label: "Kategorisiz", count: noneCount }] : [])]}
            />
          </div>
          {/* Öne Çıkanlar modu: elle işaret varsa site yalnızca onları gösterir; yoksa otomatik seçim */}
          <p className="mt-2 text-[11px] text-neutral-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            {showcase.manualFeatured > 0 ? (
              <>
                <span>Sitede yalnızca elle işaretlenen {showcase.manualFeatured} ürün öne çıkarılıyor.</span>
                <button type="button" onClick={backToAuto} className="font-semibold text-amber-800 hover:underline">
                  Otomatik seçime dön
                </button>
              </>
            ) : (
              <span>Öne çıkanlar şu an otomatik seçiliyor (hiçbir üründe elle işaret yok).</span>
            )}
          </p>
        </div>
        {(q || chips.length > 0 || catChips.length > 0) && (
          <p className="text-[11px] text-neutral-500 mt-2">
            {filtered.length} / {products.length} model gösteriliyor
          </p>
        )}
      </div>

      <AdminSelectionPanel chips={chipItems} lastId={lastId} onRemove={dropOne} onClear={() => { setSelected(new Set()); setLastId(null); }} onChipClick={focusProduct}>
        {selected.size > 0 && (
          <AdminBulkBar maxTotalDiscountPct={maxTotalDiscountPct} ids={[...selected]} scopes={scopes} onApplied={(snapshot, label) => setUndo({ snapshot, label })} extraCategories={extraCategories} onDone={() => { setSelected(new Set()); setLastId(null); }} />
        )}
      </AdminSelectionPanel>
      {notice && <p role="status" className="px-5 sm:px-6 py-2 text-[11px] text-amber-900 bg-amber-100/60 border-b border-amber-200">{notice}</p>}

      {filtered.length > 0 && (
        <label className="flex items-center gap-2 px-5 sm:px-6 py-2.5 border-b border-neutral-100 text-xs font-semibold text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="w-4 h-4 accent-amber-600" />
          Filtredeki {filtered.length} ürünün tamamını seç{filtered.length > shown ? " (görünmeyenler dahil)" : ""}
          {allFilteredSelected && <span className="font-bold text-amber-800">• Filtredeki {filtered.length} ürünün tamamı seçildi</span>}
          {selected.size > 0 && (
            <button type="button" onClick={() => { setSelected(new Set()); setLastId(null); }} className="ml-auto text-amber-700 hover:underline">
              Seçimi temizle
            </button>
          )}
        </label>
      )}

      <div className="divide-y divide-neutral-100">
        {filtered.length === 0 && (
          <p className="p-10 text-center text-xs text-neutral-400">{q ? <>&ldquo;{query}&rdquo; ile eşleşen ürün bulunamadı.</> : "Bu filtrede ürün yok."}</p>
        )}
        {filtered.slice(0, shown).map((product) => (
          <div key={product.id} id={`ap-${product.id}`} className={`scroll-mt-40 transition-colors ${flash === product.id ? "bg-amber-100/70 ring-2 ring-inset ring-amber-500" : ""}`}>
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
              <a
                href={`/urun/${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${product.title} sayfasını yeni sekmede aç`}
                className="w-16 h-16 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-neutral-200 block"
              >
                {coverImageOf(product) ? (
                  <img src={coverImageOf(product)!} alt={product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs font-serif">💡</div>
                )}
              </a>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  {product.category}
                </span>
                <h3 className="font-serif font-bold text-neutral-900 text-sm mt-0.5">
                  <a href={`/urun/${product.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 hover:underline">
                    {product.title}
                  </a>
                </h3>
                <span className="text-xs font-semibold text-neutral-600">
                  {product.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
                <DiscountBadges product={product} disabled={loadingId === product.id} onRemove={(payload, label) => removeFromProduct(product.id, payload, label)} />
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

                  {/* Tek tıkla canlı stok değişir: büyük dokunma alanı (mobilde 40px) ve ayrı, birbirine yapışmayan düğmeler */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-disabled={loadingId === v.id || v.stock <= 0}
                      onClick={() => { if (loadingId !== v.id && v.stock > 0) handleStockChange(v.id, v.stock - 1, v.stock); }}
                      aria-label={`${v.variationValue} stoğunu azalt`}
                      className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-neutral-300 text-base hover:bg-neutral-100 text-neutral-700 font-bold aria-disabled:opacity-40"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-disabled={loadingId === v.id}
                      onClick={() => { if (loadingId !== v.id) handleStockChange(v.id, v.stock + 1, v.stock); }}
                      aria-label={`${v.variationValue} stoğunu artır`}
                      className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-neutral-300 text-base hover:bg-neutral-100 text-neutral-700 font-bold aria-disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sağ: Düzenle ve Sil */}
            <div className="flex flex-wrap items-center gap-1 self-end md:self-center">
            <a
              href={`/urun/${product.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1 text-neutral-600 hover:text-amber-700 text-xs font-medium px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" /> Sitede Gör
            </a>
            <button
              type="button"
              onClick={() => setEditingId((id) => (id === product.id ? null : product.id))}
              aria-expanded={editingId === product.id}
              className="inline-flex min-h-10 items-center text-neutral-600 hover:text-amber-700 text-xs font-medium px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              ✏️ {editingId === product.id ? "Kapat" : "Düzenle"}
            </button>
            <button
              type="button"
              disabled={loadingId === product.id}
              onClick={() => handleDeleteProduct(product.id, product.title)}
              className="ml-4 inline-flex min-h-10 items-center border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold px-3 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-600"
              title="Avizeyi Katalogdan Sil"
            >
              🗑️ Modeli Sil
            </button>
            </div>
          </div>
          {editingId === product.id && (
            <AdminProductEditor
              key={`${product.id}:${product.variations.map((v) => `${v.id}${v.stock}${v.extraPrice}${(v.images ?? []).join(",")}`).join("|")}`}
              product={product}
              onSaved={(snapshot) => snapshot && setUndo({ snapshot, label: "Ürün düzenleme" })}
            />
          )}
          </div>
        ))}
      </div>
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-t border-neutral-100 text-xs text-neutral-600">
          <span>Gösterilen: {Math.min(shown, filtered.length)} / {filtered.length}</span>
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="font-semibold text-amber-800 hover:underline">
              Daha fazla göster
            </button>
          )}
        </div>
      )}
      </div>
      )}
      {undo && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-neutral-900 text-white text-xs pl-5 pr-2 py-2 shadow-2xl">
          <span>{undo.label} uygulandı.</span>
          <button type="button" disabled={undoing} onClick={() => doUndo()} className="rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 disabled:opacity-60">
            {undoing ? "Geri alınıyor..." : "↩ Son İşlemi Geri Al"}
          </button>
          <button type="button" aria-label="Kapat" onClick={() => setUndo(null)} className="px-2 text-neutral-400 hover:text-white">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
