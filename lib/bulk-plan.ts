// Toplu işlem planlama: hangi ürünlere gerçekten uygulanacağı ve hangilerinin "zaten bu durumda" olduğu.
// Saf fonksiyonlardır (veritabanı yok); /api/admin/product/bulk bunları kullanır ve testlenebilir.

export interface PlanResult {
  targets: string[]; // gerçekten değişecek ürünler
  skipped: number; // zaten bu durumda olduğu için atlananlar
}

const done = (selected: string[], targets: string[]): PlanResult => ({ targets, skipped: selected.length - targets.length });

/** Koleksiyon: zaten o koleksiyonda olanlar atlanır. */
export function planCategory(selected: string[], products: { id: string; category: string }[], category: string): PlanResult {
  const cur = new Map(products.map((p) => [p.id, p.category]));
  return done(selected, selected.filter((id) => cur.get(id) !== category));
}

/** Renk ekle: aynı renk (büyük/küçük harf duyarsız, Türkçe) zaten varsa atlanır; yinelenen varyasyon oluşturulmaz. */
export function planAddVariation(selected: string[], variations: { productId: string; variationValue: string }[], value: string): PlanResult {
  const key = (s: string) => s.toLocaleLowerCase("tr");
  const has = new Set(variations.filter((v) => key(v.variationValue) === key(value)).map((v) => v.productId));
  return done(selected, selected.filter((id) => !has.has(id)));
}

export interface FeaturedProduct {
  id: string;
  isFeatured: boolean;
}

export interface FeaturedPlan extends PlanResult {
  mode: "auto" | "manual";
  /** Önce isFeatured=true yapılacak ek ürünler (otomatik kümeyi elle işarete çevirmek için); hedefler hariç */
  markFirst: string[];
  /** İşlem sonrası sitedeki Öne Çıkanlar sayısı (yalnızca aktif ürünler) */
  before: number;
  after: number;
  /** Elle modda son işaretli ürün kaldırılırsa site otomatik seçime döner */
  revertsToAuto: boolean;
}

/**
 * Öne Çıkanlar ekle/çıkar.
 * `activeFlagged`: aktif ve isFeatured olan ürün sayısı (0 ise site OTOMATİK moddadır).
 * `autoSet`: otomatik FEATURED kümesinin (aktif) ürün kimlikleri.
 * `selectedRows`: seçili ürünlerin güncel isFeatured değerleri.
 */
export function planFeatured(value: boolean, selectedRows: FeaturedProduct[], activeFlagged: number, autoSet: Set<string>): FeaturedPlan {
  const selected = selectedRows.map((r) => r.id);
  if (activeFlagged === 0) {
    // Otomatik mod: küme ZATEN site listesindedir. Ekle → kümede olmayanlar; çıkar → kümede olanlar.
    const targets = selected.filter((id) => (value ? !autoSet.has(id) : autoSet.has(id)));
    const markFirst = targets.length > 0 ? [...autoSet].filter((id) => !targets.includes(id)) : [];
    const before = autoSet.size;
    return { ...done(selected, targets), mode: "auto", markFirst, before, after: targets.length ? (value ? before + targets.length : before - targets.length) : before, revertsToAuto: false };
  }
  const targets = selectedRows.filter((r) => r.isFeatured !== value).map((r) => r.id);
  const after = value ? activeFlagged + targets.length : activeFlagged - targets.length; // aktiflik ayrımı sunucuda yapılır; yaklaşık sayı
  return { ...done(selected, targets), mode: "manual", markFirst: [], before: activeFlagged, after: Math.max(0, after), revertsToAuto: !value && targets.length > 0 && after <= 0 };
}

/** Çok Satanlar: ekle → zaten site listesindeyse atla; çıkar → işaretli değilse atla. */
export function planBestSeller(value: boolean, selectedRows: { id: string; isBestSeller: boolean }[], displayed: Set<string>): PlanResult {
  const selected = selectedRows.map((r) => r.id);
  return done(selected, selectedRows.filter((r) => (value ? !displayed.has(r.id) : r.isBestSeller)).map((r) => r.id));
}

/** Toplu işlemin sonuç iletisi. */
export function resultMessage(updated: number, skipped: number): string {
  return updated === 0 ? "Seçili ürünlerin hepsi zaten bu durumda." : `${updated} ürün güncellendi, ${skipped} ürün zaten bu durumda olduğu için atlandı.`;
}
