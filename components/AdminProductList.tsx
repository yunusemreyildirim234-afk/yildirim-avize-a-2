"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isPurchasablePrice } from "@/lib/purchasable";
import { AlertTriangle, Boxes, ChevronDown, ExternalLink, FileText, Lightbulb, MoreHorizontal, Pencil, Search, Trash2, Undo2 } from "lucide-react";
import { useOpenOnHash } from "@/components/useOpenOnHash";
import { useRouter } from "next/navigation";
import { refreshAdminNow, scheduleAdminRefresh } from "@/lib/admin-refresh";
import { applyHiddenIds, applyPatch, emptyPatch, withPatched, type ProductPatch } from "@/lib/admin-product-patch";
import AdminBulkBar from "@/components/AdminBulkBar";
import AdminComplementDialog from "@/components/AdminComplementDialog";
import AdminSelectionPanel, { scrollToRow } from "@/components/AdminSelectionPanel";
import { addAll, chipLabel, nextLastId, removeAll, removeId, toggleId } from "@/lib/admin-selection";
import AdminProductEditor from "@/components/AdminProductEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminDescriptionEditor from "@/components/AdminDescriptionEditor";
import { activeConfirmMessage } from "@/lib/bulk-plan";
import SmartFilterChips from "@/components/SmartFilterChips";
import AdminProductFilterPanel from "@/components/AdminProductFilterPanel";
import ScrollChips from "@/components/ScrollChips";
import { EMPTY_FILTERS, adminFacets, applyAdminFilters, hasAdminFilters, type AdminFilterState } from "@/lib/admin-product-filters";
import { adminCodeFirst, searchAdminProducts } from "@/lib/admin-product-search";
import { bulkTiersOf, tierBadgeLabel, tierValueLabel } from "@/lib/bulk-pricing";
import { CATEGORIES } from "@/lib/site";
import { buildCategoryList, productInCategory } from "@/lib/categories";
import { uncategorizedCount } from "@/lib/category-settings";
import { isShownAsSoldOut, type StocklessRule } from "@/lib/stockless";
import { smallImage } from "@/lib/img";
import { QUICK_FILTER_LABELS, isQuickFilterKey, quickFilterTest, type QuickFilterKey } from "@/lib/admin-product-quick-filters";

const NONE_KEY = "__kategorisiz__"; // "Kategorisiz (N)" çipi
import { mergeImages, rowCover, type ProductImagesDetail } from "@/lib/admin-product-list";
import { productPath } from "@/lib/product-url";

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
  ebat?: string | null;
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
// Pasif ama en az bir varyasyonu stoklu: vitrinde GÖRÜNMEZ (satış kaybı riski); kural bilinçli olarak değişmez, yönetici uyarılır
const totalStockOf = (p: Product) => p.variations.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
const stockedInactive = (p: Product) => p.active === false && totalStockOf(p) > 0;
const chipTest = (key: string, p: Product, sets: ChipSets): boolean =>
  isQuickFilterKey(key) ? quickFilterTest(key, p) : key === "stockedinactive" ? stockedInactive(p) : key === "discount" ? hasDiscount(p) : key === "featured" ? sets.featured.has(p.id) : key === "bestseller" ? sets.bestseller.has(p.id) : false;

/** Satırdaki "⋯" menüsü: Escape ve dış tıklama kapatır (Escape'te odak düğmeye döner); menü rolü. */
function RowMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => {
      if (ref.current) ref.current.open = false;
      setOpen(false);
    };
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <details ref={ref} className="relative" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary
        aria-label="Diğer işlemler"
        aria-haspopup="menu"
        title="Diğer işlemler"
        className="inline-flex min-h-10 md:min-h-9 cursor-pointer list-none items-center rounded-lg px-3 text-neutral-600 hover:bg-neutral-100 [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <MoreHorizontal aria-hidden="true" className="w-4 h-4" />
      </summary>
      <div role="menu" aria-label="Diğer işlemler" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
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

export default function AdminProductList({ products: serverProducts, maxTotalDiscountPct, showcase, extraCategories = [], categoryTitles = {}, stocklessRule: serverStocklessRule }: { products: Product[]; maxTotalDiscountPct?: number | null; extraCategories?: string[]; categoryTitles?: Record<string, string>; stocklessRule?: StocklessRule; showcase: { featured: string[]; bestSellers: string[]; manualFeatured: number } }) {
  const sets = useMemo<ChipSets>(() => ({ featured: new Set(showcase.featured), bestseller: new Set(showcase.bestSellers) }), [showcase]);
  const router = useRouter();
  // Yerel yama (CMP-02): stok ±, aktif/pasif ve "stoksuzken gizle" için SUNUCUNUN döndürdüğü değer yerelde tutulur; tam yenileme
  // sakin kalınca tek seferde (scheduleAdminRefresh) gelir. Sunucudan yeni liste gelince yama geçersiz sayılır (lib/admin-product-patch.ts).
  const [patch, setPatch] = useState<ProductPatch<Product>>(() => emptyPatch(serverProducts));
  const products = useMemo(() => applyPatch(serverProducts, patch), [serverProducts, patch]);
  const stocklessRule = useMemo<StocklessRule | undefined>(
    () => (serverStocklessRule ? { ...serverStocklessRule, hiddenIds: applyHiddenIds(serverStocklessRule.hiddenIds, serverProducts, patch) } : undefined),
    [serverStocklessRule, serverProducts, patch]
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useOpenOnHash("urunler", setOpen);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); // ürün KİMLİKLERİ: süzgeç/arama/sayfalama değişse de korunur
  const [lastId, setLastId] = useState<string | null>(null); // son seçilen ürün ("Seçtiğim yere dön")
  const [flash, setFlash] = useState<string | null>(null); // çipten gidilen satırın kısa vurgusu
  const [notice, setNotice] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [descId, setDescId] = useState<string | null>(null); // açıklaması düzenlenen ürün
  const [chips, setChips] = useState<string[]>([]);
  const [adv, setAdv] = useState<AdminFilterState>(EMPTY_FILTERS); // sırala + renk/ebat/fiyat/stok durumu (lib/admin-product-filters.ts)
  const [catChips, setCatChips] = useState<string[]>([]); // kategori çipleri (anahtar: categoryKey); diğer çiplerle KESİŞİR
  const PAGE = 8;
  const [shown, setShown] = useState(PAGE); // listede gösterilen ürün sayısı (8'er artar)
  // Son işlem öncesi durum (Geri Al)
  // earlier: aynı işlemin daha önce üretilen belirteçleri (düzenleyicide "Tümünü kaydet" birden çok kayıt yapar); geri alma ters sırayla gider
  const [undo, setUndo] = useState<{ snapshot: unknown; label: string; earlier?: unknown[] } | null>(null);
  const [undoing, setUndoing] = useState(false);
  // Açık düzenleyicide kaydedilmemiş değişiklik var mı (kapatırken onay; Geri Al çubuğu kayıt çubuğunun üstüne taşınır)
  const [editorDirty, setEditorDirty] = useState(false);
  const [complementOpen, setComplementOpen] = useState(false); // "Tamamlayıcı ürün ekle" iletişim kutusu
  const [deleteAsk, setDeleteAsk] = useState<{ id: string; title: string } | null>(null); // "Modeli Sil" sayfa içi onayı
  // Liste dar veriyle gelir (görsel dizileri yok): düzenleyici açılınca tek ürünün TAM görselleri GET /api/admin/product?fields=images ile çekilir.
  // Düzenleyici bu veri gelmeden bağlanmaz; kayıt ve renk ekleme/silme sonrası sessizce yeniden çekilir.
  const [details, setDetails] = useState<Record<string, ProductImagesDetail>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const loadedRef = useRef(false); // açık düzenleyici için en az bir kez tam veri geldi mi
  const loadDetail = async (id: string) => {
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/product?productId=${encodeURIComponent(id)}&fields=images`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Görseller yüklenemedi.");
      if (editingRef.current !== id) return; // düzenleyici arada kapandı/başka ürüne geçildi
      loadedRef.current = true;
      setDetails((d) => ({ ...d, [id]: { imageUrl: data.imageUrl ?? null, images: data.images ?? [], variations: data.variations ?? [] } }));
    } catch (e) {
      // Daha önce yüklenmiş veri varsa o korunur (sessiz yenileme hatası açık düzenleyiciyi bozmaz)
      if (editingRef.current === id && !loadedRef.current) setDetailError((e as Error).message || "Görseller yüklenemedi.");
    }
  };
  const toggleEdit = (id: string) => {
    if (editingId && editorDirty && !confirm("Düzenleyicide kaydedilmemiş değişiklikler var. Kapatılırsa kaybolur. Devam edilsin mi?")) return;
    const next = editingId === id ? null : id;
    setDetails({}); // her açılışta taze görseller (eski açılıştan kalan veri düzenleyiciye girmez)
    setDetailError(null);
    editingRef.current = next;
    loadedRef.current = false;
    setEditingId(next);
  };
  // Açılışta ve her sunucu yenilemesinden sonra (kayıt, renk ekleme/silme, ad düzenleme hepsi router.refresh çağırır) tam görseller yeniden çekilir
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (editingId) void loadDetail(editingId);
  }, [editingId, serverProducts]);

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
      refreshAdminNow(router); // toplu işlem: hemen
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const doUndo = async () => {
    if (!undo) return;
    setUndoing(true);
    // Kayıt sırasıyla dizilir; en son kaydedilen en sonda. Geri alma sondan başa gider, başarısız olan ve öncekiler çubukta kalır.
    let queue = [...(undo.earlier ?? []), undo.snapshot];
    const total = queue.length;
    const post = async (snapshot: unknown, force: boolean) => {
      const res = await fetch("/api/admin/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot, force }) });
      return { res, data: await res.json().catch(() => ({})) };
    };
    try {
      while (queue.length > 0) {
        const snapshot = queue[queue.length - 1];
        let r = await post(snapshot, false);
        // Ürün işlemden sonra başka yerde değiştiyse: kullanıcıya sorulur, onaylarsa zorla geri alınır
        if (r.res.status === 409 && r.data.conflict) {
          if (!confirm(`${r.data.error}

Yine de geri alınsın mı?`)) break;
          r = await post(snapshot, true);
        }
        if (!r.res.ok) throw new Error(r.data.error || "Geri alınamadı.");
        queue = queue.slice(0, -1);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUndo(queue.length > 0 ? { snapshot: queue[queue.length - 1], earlier: queue.slice(0, -1), label: undo.label } : null);
      if (queue.length < total) refreshAdminNow(router); // geri alma birden çok alanı değiştirir: hemen
      setUndoing(false);
    }
  };

  // Aktif yap / pasife al (tek ürün): onay şart; sunucu /api/admin/product PATCH {productId, active}; Geri Al belirteci döner
  const setActive = async (p: Product, makeActive: boolean) => {
    const total = totalStockOf(p);
    const stillShown = !makeActive && stocklessRule && isShownAsSoldOut({ id: p.id, active: false, totalStock: total, category: p.category }, stocklessRule) ? 1 : 0;
    if (!confirm(activeConfirmMessage({ makeActive, count: 1, title: p.title, soldOut: makeActive && total === 0 ? 1 : 0, stillShown }))) return;
    setLoadingId(p.id);
    try {
      const res = await fetch("/api/admin/product", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, active: makeActive }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) refreshAdminNow(router);
        throw new Error(data.error || "İşlem başarısız.");
      }
      if (data.snapshot) setUndo({ snapshot: data.snapshot, label: makeActive ? "Aktif yapma" : "Pasife alma" });
      if (typeof data.active === "boolean") {
        setPatch((cur) => withPatched(cur, serverProducts, "active", p.id, data.active)); // sunucunun yazdığı değer
        scheduleAdminRefresh(router);
      } else refreshAdminNow(router);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  // Ürün bazlı istisna kutusu: anında kaydedilir (vitrin önbelleği sunucuda temizlenir)
  const setStocklessHidden = async (p: Product, hidden: boolean) => {
    setLoadingId(p.id);
    try {
      const res = await fetch("/api/admin/product", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, stocklessHidden: hidden }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) refreshAdminNow(router);
        throw new Error(data.error || "İşlem başarısız.");
      }
      if (typeof data.stocklessHidden === "boolean") {
        setPatch((cur) => withPatched(cur, serverProducts, "hidden", p.id, data.stocklessHidden)); // sunucunun yazdığı değer
        scheduleAdminRefresh(router);
      } else refreshAdminNow(router);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  // Rozet ×: tek ürün için seçici indirim kaldırma
  const removeFromProduct = async (productId: string, payload: Record<string, unknown>, label: string) => {
    setLoadingId(productId);
    try {
      const res = await fetch("/api/admin/product/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [productId], action: "removeDiscount", ...payload }) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) refreshAdminNow(router);
        throw new Error(data.error || "İşlem başarısız.");
      }
      if (data.snapshot) setUndo({ snapshot: data.snapshot, label });
      refreshAdminNow(router); // yanıt yeni indirim değerlerini taşımaz (yalnız geri alma belirteci): tahmin yerine hemen yenile
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
  // Sabit kategorilerin görünen adı vitrindeki gibi: yönetimden verilen ad (CategorySettings.title) varsa o, yoksa site.ts adı
  const catEntries = useMemo(
    () => buildCategoryList(products.map((p) => ({ category: p.category, count: 1 })), CATEGORIES).map((c) => (c.fixed && categoryTitles[c.key] ? { ...c, title: categoryTitles[c.key] } : c)),
    [products, categoryTitles]
  );
  const selectedCats = catEntries.filter((c) => catChips.includes(c.key));
  const noneCount = uncategorizedCount(products); // kategorisiz ürün sayısı (boş / yalnız boşluk)
  const noneOn = catChips.includes(NONE_KEY);
  const chipFiltered = selectedCats.length || noneOn ? chipFiltered0.filter((p) => (noneOn && !p.category.trim()) || selectedCats.some((c) => productInCategory(p.category, c))) : chipFiltered0;
  const searched = useMemo(() => (q ? searchAdminProducts(chipFiltered, query) : chipFiltered), [q, query, chipFiltered]); // kurallar lib/admin-product-search.ts
  // Gelişmiş süzgeçler arama/çip/kategori sonucuyla KESİŞİR; sıralama sonuca uygulanır. Rakam sorgusunda varsayılan sıralamada model kodu/stok kodu eşleşen en üstte
  const filtered = useMemo(() => {
    const f = applyAdminFilters(searched, adv, sets);
    return q && adv.siralama === "varsayilan" ? adminCodeFirst(f, query) : f;
  }, [searched, adv, sets, q, query]);
  const facets = useMemo(() => adminFacets(searched, adv), [searched, adv]);
  const advActive = hasAdminFilters(adv) || adv.siralama !== "varsayilan";
  const clearAllFilters = () => { setQuery(""); setChips([]); setCatChips([]); setAdv(EMPTY_FILTERS); setShown(PAGE); };

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
        body: JSON.stringify({ variationId, stock: newStock, prevStock: oldStock }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.snapshot) setUndo({ snapshot: data.snapshot, label: `Stok ${oldStock} → ${newStock}` });
        const saved = typeof data.variation?.stock === "number" ? data.variation.stock : newStock; // sunucunun yazdığı değer
        setPatch((cur) => withPatched(cur, serverProducts, "stock", variationId, saved));
      } else {
        if (res.status === 409) refreshAdminNow(router); // "bu sırada değişti": sunucu verisini hemen getir
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
        refreshAdminNow(router); // model kodu: hemen
      } else {
        if (res.status === 409) refreshAdminNow(router);
        alert("Model kodu kaydedilemedi: " + data.error);
      }
    } catch {
      alert("İşlem tamamlanamadı.");
    } finally {
      setLoadingId(null);
    }
  };

  // Ürünü Sil
  const handleDeleteProduct = async (productId: string, title: string) => {
    setDeleteAsk(null);
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
        refreshAdminNow(router); // silme: hemen
      } else {
        if (res.status === 409) refreshAdminNow(router);
        alert("Silinemedi: " + data.error);
      }
    } catch {
      alert("İşlem tamamlanamadı.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div id="urunler" className="scroll-mt-[var(--admin-offset,6rem)] bg-white rounded-2xl border border-neutral-200 overflow-clip shadow-sm">
      <ConfirmDialog
        open={deleteAsk !== null}
        title="Model silinsin mi?"
        confirmLabel="Evet, sil"
        danger
        onConfirm={() => deleteAsk && handleDeleteProduct(deleteAsk.id, deleteAsk.title)}
        onCancel={() => setDeleteAsk(null)}
      >
        <p className="font-semibold text-neutral-900">&quot;{deleteAsk?.title}&quot; modeli katalogdan silinecek (geçmiş siparişi varsa silinmez, yalnızca pasife alınır).</p>
        <p>Silindikten sonra alttaki çubuktan geri alabilirsiniz.</p>
      </ConfirmDialog>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-product-panel"
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Boxes aria-hidden="true" className="w-4 h-4 text-amber-600" /> Tüm Ürünler • Avize Kataloğu & Stok Yönetimi
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Mevcut avizelerin varyasyon stoklarını canlı artırıp azaltabilir; silme işlemi satırdaki “⋯” menüsündedir.
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
          <ScrollChips>
          <SmartFilterChips
            nowrap
            label="Ürün vitrin ve indirim filtreleri"
            selected={chips}
            onChange={(c) => { setChips(c); setShown(PAGE); }}
            total={products.length}
            options={[
              { key: "discount", label: "İndirimdekiler", count: products.filter((p) => chipTest("discount", p, sets)).length },
              { key: "featured", label: "Öne Çıkanlar", count: products.filter((p) => chipTest("featured", p, sets)).length },
              { key: "bestseller", label: "Çok Satanlar", count: products.filter((p) => chipTest("bestseller", p, sets)).length },
              ...(products.some(stockedInactive) ? [{ key: "stockedinactive", label: "Stoğu var ama pasif", count: products.filter(stockedInactive).length }] : []),
              ...(Object.keys(QUICK_FILTER_LABELS) as QuickFilterKey[]).map((key) => ({ key, label: QUICK_FILTER_LABELS[key], count: products.filter((p) => quickFilterTest(key, p)).length })),
            ]}
          />
          </ScrollChips>
          <div className="mt-2">
            <ScrollChips>
            <SmartFilterChips
              nowrap
              label="Ürün kategori filtreleri"
              selected={catChips}
              onChange={(c) => { setCatChips(c); setShown(PAGE); }}
              total={products.length}
              allLabel="Tüm kategoriler"
              options={[...catEntries.filter((c) => c.count > 0).map((c) => ({ key: c.key, label: c.title, count: c.count })), ...(noneCount > 0 ? [{ key: NONE_KEY, label: "Kategorisiz", count: noneCount }] : [])]}
            />
            </ScrollChips>
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
        <AdminProductFilterPanel
          state={adv}
          onChange={(next) => { setAdv(next); setShown(PAGE); }}
          colors={facets.colors}
          sizes={facets.sizes}
          onClearAll={clearAllFilters}
          anyActive={Boolean(q) || chips.length > 0 || catChips.length > 0}
        />
        {(q || chips.length > 0 || catChips.length > 0 || advActive) && (
          <p className="text-[11px] text-neutral-500 mt-2">
            {filtered.length} / {products.length} model gösteriliyor
          </p>
        )}
      </div>

      <AdminSelectionPanel chips={chipItems} lastId={lastId} onRemove={dropOne} onClear={() => { setSelected(new Set()); setLastId(null); }} onChipClick={focusProduct}>
        {selected.size > 0 && (
          <div className="px-5 sm:px-6 pt-3">
            <button type="button" onClick={() => setComplementOpen(true)} className="inline-flex items-center min-h-10 rounded-lg border border-amber-600 px-4 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600">
              Tamamlayıcı ürün ekle
            </button>
          </div>
        )}
        {selected.size > 0 && (
          <AdminBulkBar maxTotalDiscountPct={maxTotalDiscountPct} expectedStock={Object.fromEntries([...selected].flatMap((id) => (byId.get(id)?.variations ?? []).map((v) => [v.id, v.stock])))} ids={[...selected]} scopes={scopes} onApplied={(snapshot, label) => setUndo({ snapshot, label })} extraCategories={extraCategories} categoryTitles={categoryTitles} onDone={() => { setSelected(new Set()); setLastId(null); }} />
        )}
      </AdminSelectionPanel>
      {complementOpen && selected.size > 0 && (
        <AdminComplementDialog mainIds={[...selected]} products={products} onClose={() => setComplementOpen(false)} onChanged={() => refreshAdminNow(router)} />
      )}
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
          <div className="px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors">
            {/* Sol: Seçim, Görsel ve Başlık */}
            <div className="flex items-center gap-4 md:w-96 md:shrink-0">
              <input
                type="checkbox"
                aria-label={`${product.title} seç`}
                checked={selected.has(product.id)}
                onChange={() => toggleOne(product.id)}
                className="w-4 h-4 accent-amber-600 shrink-0"
              />
              <a
                href={productPath(product)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${product.title} sayfasını yeni sekmede aç`}
                className="w-16 h-16 rounded-xl bg-neutral-200 overflow-hidden shrink-0 border border-neutral-200 block"
              >
                {rowCover(product, details[product.id]) ? (
                  <img src={smallImage(rowCover(product, details[product.id])!)} alt={product.title} width={64} height={64} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs font-serif"><Lightbulb aria-hidden="true" className="w-5 h-5" /></div>
                )}
              </a>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  {product.category}
                </span>
                <h3 className="font-serif font-bold text-neutral-900 text-sm mt-0.5">
                  <a href={productPath(product)} target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 hover:underline">
                    {product.title}
                  </a>
                </h3>
                <span className="text-xs font-semibold text-neutral-600">
                  {product.basePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </span>
                {!isPurchasablePrice(product.basePrice) && (
                  <p data-testid="fiyat-sifir-rozet" className="mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-900">
                    <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-red-700" />
                    <span>Fiyatı 0: satış engelli, fiyat girin</span>
                  </p>
                )}
                <DiscountBadges product={product} disabled={loadingId === product.id} onRemove={(payload, label) => removeFromProduct(product.id, payload, label)} />
                {stockedInactive(product) && (
                  <p data-testid="stoklu-pasif-rozet" className="mt-1.5 flex flex-wrap sm:inline-flex max-w-full items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-950">
                    <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <span>Stoğu var ama pasif: vitrinde görünmüyor</span>
                    <button type="button" data-testid="vitrine-al" disabled={loadingId === product.id} onClick={() => setActive(product, true)} className="mt-1 sm:mt-0 sm:ml-1 inline-flex min-h-10 w-full sm:w-auto items-center justify-center rounded-md bg-neutral-900 px-3 font-bold text-white hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600">
                      Vitrine al (aktif yap)
                    </button>
                  </p>
                )}
                {stocklessRule && isShownAsSoldOut({ id: product.id, active: product.active !== false, totalStock: totalStockOf(product), category: product.category }, stocklessRule) && (
                  <p data-testid="vitrinde-tukendi-notu" className="mt-1.5 text-[11px] text-neutral-600">Vitrinde Tükendi olarak görünür</p>
                )}
                {stocklessRule?.hiddenIds.includes(product.id) && (
                  <p data-testid="stoksuz-istisna-notu" className="mt-1.5 text-[11px] text-neutral-600">Stoksuz olunca vitrinde gösterilmez (ürün istisnası)</p>
                )}
                <ModelCodeEditor
                  key={`${product.id}-${product.modelCode ?? ""}`}
                  initial={product.modelCode ?? ""}
                  disabled={loadingId === product.id}
                  onSave={(code) => handleModelCodeSave(product.id, code)}
                />
              </div>
            </div>

            {/* Orta: Varyasyonlar ve Stok Butonları */}
            {/* Sabit genişlikli varyasyon kutuları: başlık uzunluğu yatay hizayı kaydırmaz */}
            <div className="flex flex-wrap items-center gap-3 md:flex-1 md:min-w-0">
              {product.variations.map((v) => (
                <div key={v.id} className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 flex w-full sm:w-56 items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="min-w-0">
                    <span className="font-medium text-neutral-800 block text-xs truncate" title={v.variationValue}>{v.variationValue}</span>
                    <span className="text-[11px] text-neutral-600">Stok: <strong className="text-neutral-900">{v.stock}</strong></span>
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
            <div className="flex flex-wrap items-center gap-1 self-end md:self-center md:shrink-0">
            <a
              href={productPath(product)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1 text-neutral-600 hover:text-amber-700 text-xs font-medium px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" /> Sitede Gör
            </a>
            <button
              type="button"
              onClick={() => toggleEdit(product.id)}
              aria-expanded={editingId === product.id}
              className="inline-flex min-h-10 items-center gap-1.5 text-neutral-600 hover:text-amber-700 text-xs font-medium px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Pencil aria-hidden="true" className="w-3.5 h-3.5" /> {editingId === product.id ? "Kapat" : "Düzenle"}
            </button>
            <button
              type="button"
              data-testid="aciklama-duzenle"
              onClick={() => setDescId((id) => (id === product.id ? null : product.id))}
              aria-expanded={descId === product.id}
              className="inline-flex min-h-10 items-center gap-1.5 text-neutral-600 hover:text-amber-700 text-xs font-medium px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <FileText aria-hidden="true" className="w-3.5 h-3.5" /> {descId === product.id ? "Açıklamayı kapat" : "Açıklamayı düzenle"}
            </button>
            <RowMenu>
              <button
                type="button"
                role="menuitem"
                disabled={loadingId === product.id}
                onClick={() => setDeleteAsk({ id: product.id, title: product.title })}
                className="flex min-h-10 w-full items-center gap-1.5 rounded-md text-red-700 hover:bg-red-50 text-xs font-semibold px-3 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-600"
                title="Avizeyi Katalogdan Sil"
              >
                <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> Modeli Sil
              </button>
            </RowMenu>
            </div>
          </div>
          {descId === product.id && <AdminDescriptionEditor key={product.id} productId={product.id} title={product.title} />}
          {editingId === product.id && !details[product.id] && (
            <div className="bg-neutral-50 border-t border-neutral-100 p-5 text-xs" role="status">
              {detailError ? (
                <p className="flex flex-wrap items-center gap-3 font-semibold text-red-800">
                  <span role="alert">Görseller yüklenemedi: {detailError}</span>
                  <button type="button" onClick={() => void loadDetail(product.id)} className="inline-flex min-h-10 items-center rounded-lg border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 hover:border-amber-600 focus-visible:outline-2 focus-visible:outline-amber-600">
                    Yeniden dene
                  </button>
                </p>
              ) : (
                <p className="text-neutral-600">Düzenleyici yükleniyor…</p>
              )}
            </div>
          )}
          {editingId === product.id && details[product.id] && (
            <AdminProductEditor
              key={product.id} // veri değişince yeniden bağlanmaz: düzenleyici sunucu verisiyle kendi uzlaşır (kaydedilmemiş değişiklik kaybolmaz)
              product={{ ...mergeImages(product, details[product.id]), stocklessHidden: stocklessRule?.hiddenIds.includes(product.id) ?? false }}
              onDirtyChange={setEditorDirty}
              busyActive={loadingId === product.id}
              onSetActive={(makeActive) => setActive(product, makeActive)}
              onSetStocklessHidden={stocklessRule ? (hidden) => setStocklessHidden(product, hidden) : undefined}
              onSaved={(snapshots) => snapshots.length > 0 && setUndo({ snapshot: snapshots[snapshots.length - 1], earlier: snapshots.slice(0, -1), label: snapshots.length > 1 ? `Ürün düzenleme (${snapshots.length} kayıt)` : "Ürün düzenleme" })}
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
        <div role="status" className={`fixed ${editingId && editorDirty ? "bottom-32 sm:bottom-24" : "bottom-4"} left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-neutral-900 text-white text-xs pl-5 pr-2 py-2 shadow-2xl`}>
          <span>{undo.label} uygulandı.</span>
          <button type="button" disabled={undoing} onClick={() => doUndo()} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 disabled:opacity-60">
            {undoing ? "Geri alınıyor..." : <><Undo2 aria-hidden="true" className="w-3.5 h-3.5" /> Son İşlemi Geri Al</>}
          </button>
          <button type="button" aria-label="Kapat" onClick={() => setUndo(null)} className="px-2 text-neutral-400 hover:text-white">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
