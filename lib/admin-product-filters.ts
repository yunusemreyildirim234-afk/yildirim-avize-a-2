// Admin ürün listesi: sırala + renk/ebat/fiyat/stok durumu süzgeçleri. İstemci tarafı, saf (sorgu yok).
// Müşteri tarafı listing-core yardımcıları yalnızca içe aktarılır; mevcut arama/çip/kategori süzgeçleriyle KESİŞİR (bu işlev onların çıktısını alır).
import { SORT_LABELS, parseSize, variationAttrs, type Attr } from "./listing-core.ts";
import { isOutOfStock } from "./admin-product-quick-filters.ts";

export const ADMIN_SORTS = ["varsayilan", "fiyat-artan", "fiyat-azalan", "ebat-artan", "ebat-azalan", "cok-satan", "one-cikan", "en-yeni", "stok-artan", "stok-azalan", "ad-az"] as const;
export type AdminSort = (typeof ADMIN_SORTS)[number];
export const ADMIN_SORT_LABELS: Record<AdminSort, string> = {
  varsayilan: "Varsayılan",
  "fiyat-artan": SORT_LABELS["fiyat-artan"],
  "fiyat-azalan": SORT_LABELS["fiyat-azalan"],
  "ebat-artan": SORT_LABELS["ebat-artan"],
  "ebat-azalan": SORT_LABELS["ebat-azalan"],
  "cok-satan": SORT_LABELS["cok-satan"],
  "one-cikan": SORT_LABELS["one-cikan"],
  "en-yeni": SORT_LABELS["en-yeni"],
  "stok-artan": "Stok: Azdan çoğa",
  "stok-azalan": "Stok: Çoktan aza",
  "ad-az": "Ad: A → Z",
};

export type StockMode = "hepsi" | "stokta" | "stoksuz";
export interface AdminFilterState {
  siralama: AdminSort;
  renkler: string[];
  ebatlar: string[];
  fiyatMin?: number;
  fiyatMax?: number;
  stok: StockMode;
}
export const EMPTY_FILTERS: AdminFilterState = { siralama: "varsayilan", renkler: [], ebatlar: [], stok: "hepsi" };

export interface FilterProduct {
  id: string;
  title: string;
  basePrice: number;
  ebat?: string | null;
  variations: { variationType: string; variationValue: string; stock: number }[];
}
export interface ShowcaseSets {
  featured: ReadonlySet<string>;
  bestseller: ReadonlySet<string>;
}

/** Süzgeç/sıra varsayılandan farklı mı (sıralama dahil değil: yalnız süzgeçler). */
export const hasAdminFilters = (s: AdminFilterState) => s.renkler.length > 0 || s.ebatlar.length > 0 || s.fiyatMin !== undefined || s.fiyatMax !== undefined || s.stok !== "hepsi";
export const isDefaultAdminState = (s: AdminFilterState) => s.siralama === "varsayilan" && !hasAdminFilters(s);

const totalStock = (p: FilterProduct) => p.variations.reduce((n, v) => n + Math.max(0, v.stock), 0);

interface VarAttrs {
  c: Attr | null;
  s: Attr | null;
}
const varAttrs = (p: FilterProduct): VarAttrs[] => p.variations.map((v) => variationAttrs(v.variationType, v.variationValue));
const ownSize = (p: FilterProduct): Attr | null => (p.ebat ? parseSize(p.ebat) : null);

/** Renk + ebat eşleşmesi (müşteri kuralı): yalnız biri seçiliyse ürün düzeyinde; ikisi birlikte seçiliyse AYNI varyasyon hem rengi hem ebatı taşır. Ürün ebatı her varyasyon için geçerlidir. */
function colorSizeOk(p: FilterProduct, colors: ReadonlySet<string>, sizes: ReadonlySet<string>): boolean {
  if (colors.size === 0 && sizes.size === 0) return true;
  const own = ownSize(p);
  const ownHit = own !== null && sizes.has(own.k);
  const vars = varAttrs(p);
  if (colors.size === 0) return ownHit || vars.some((v) => v.s !== null && sizes.has(v.s.k));
  return vars.some((v) => v.c !== null && colors.has(v.c.k) && (sizes.size === 0 || ownHit || (v.s !== null && sizes.has(v.s.k))));
}
const priceOk = (p: FilterProduct, s: AdminFilterState) => (s.fiyatMin === undefined || p.basePrice >= s.fiyatMin) && (s.fiyatMax === undefined || p.basePrice <= s.fiyatMax);
const stockOk = (p: FilterProduct, mode: StockMode) => mode === "hepsi" || (mode === "stoksuz" ? isOutOfStock(p) : !isOutOfStock(p));

const sizeNums = (k: string): [number, number] => {
  const [a, b] = k.split("x").map(Number);
  return [a, b];
};
const cmpPair = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];
/** Ürünün ebat anahtarları (varyasyon ebatları ∪ ürün ebatı), küçükten büyüğe. */
function sizeKeysOf(p: FilterProduct): [number, number][] {
  const ks = [...varAttrs(p).flatMap((v) => (v.s ? [v.s.k] : [])), ...(ownSize(p) ? [ownSize(p)!.k] : [])].map(sizeNums);
  return ks.sort(cmpPair);
}

export function sortProducts<T extends FilterProduct>(list: readonly T[], sort: AdminSort, sets: ShowcaseSets): T[] {
  const idx = new Map(list.map((p, i) => [p.id, i]));
  const byIdx = (a: T, b: T) => idx.get(a.id)! - idx.get(b.id)!;
  const bySize = (dir: 1 | -1) => {
    const keys = new Map(list.map((p) => [p.id, sizeKeysOf(p)]));
    return (a: T, b: T) => {
      const ka = keys.get(a.id)!;
      const kb = keys.get(b.id)!;
      if (!ka.length || !kb.length) return ka.length === kb.length ? byIdx(a, b) : ka.length ? -1 : 1; // ebatsızlar iki yönde de sonda
      const pick = (ks: [number, number][]) => (dir === 1 ? ks[0] : ks[ks.length - 1]);
      return dir * cmpPair(pick(ka), pick(kb)) || byIdx(a, b);
    };
  };
  const cmp: Record<AdminSort, (a: T, b: T) => number> = {
    varsayilan: byIdx,
    "en-yeni": byIdx, // sunucu listesi createdAt azalan gelir: varsayılan sıra = en yeni üstte
    "fiyat-artan": (a, b) => a.basePrice - b.basePrice || byIdx(a, b),
    "fiyat-azalan": (a, b) => b.basePrice - a.basePrice || byIdx(a, b),
    "ebat-artan": bySize(1),
    "ebat-azalan": bySize(-1),
    "cok-satan": (a, b) => Number(sets.bestseller.has(b.id)) - Number(sets.bestseller.has(a.id)) || byIdx(a, b),
    "one-cikan": (a, b) => Number(sets.featured.has(b.id)) - Number(sets.featured.has(a.id)) || byIdx(a, b),
    "stok-artan": (a, b) => totalStock(a) - totalStock(b) || byIdx(a, b),
    "stok-azalan": (a, b) => totalStock(b) - totalStock(a) || byIdx(a, b),
    "ad-az": (a, b) => a.title.localeCompare(b.title, "tr") || byIdx(a, b),
  };
  return [...list].sort(cmp[sort]);
}

/** Süzgeçleri uygular (hepsi kesişir) ve sıralar. */
export function applyAdminFilters<T extends FilterProduct>(list: readonly T[], s: AdminFilterState, sets: ShowcaseSets): T[] {
  const colors = new Set(s.renkler);
  const sizes = new Set(s.ebatlar);
  const kept = list.filter((p) => stockOk(p, s.stok) && priceOk(p, s) && colorSizeOk(p, colors, sizes));
  return sortProducts(kept, s.siralama, sets);
}

export interface FacetOption {
  key: string;
  name: string;
  count: number;
  selected: boolean;
}

/** Renk/ebat seçenekleri ve sayıları: o grup KENDİ süzgeci hariç, diğer süzgeçlere göre; ürün başına bir kez. */
export function adminFacets(list: readonly FilterProduct[], s: AdminFilterState): { colors: FacetOption[]; sizes: FacetOption[] } {
  const colors = new Set(s.renkler);
  const sizes = new Set(s.ebatlar);
  const tally = (attr: "c" | "s", otherWant: Set<string>, want: Set<string>): FacetOption[] => {
    const m = new Map<string, { names: Map<string, number>; count: number }>();
    for (const p of list) {
      if (!stockOk(p, s.stok) || !priceOk(p, s)) continue;
      const own = ownSize(p);
      const ownHit = own !== null && otherWant.has(own.k);
      const seen = new Set<string>();
      const add = (a: Attr) => {
        const g = m.get(a.k) ?? { names: new Map<string, number>(), count: 0 };
        g.names.set(a.n, (g.names.get(a.n) ?? 0) + 1);
        if (!seen.has(a.k)) {
          seen.add(a.k);
          g.count += 1;
        }
        m.set(a.k, g);
      };
      const vars = varAttrs(p);
      for (const v of vars) {
        const a = v[attr];
        if (!a) continue;
        const otherOk = otherWant.size === 0 || (attr === "c" ? ownHit || (v.s !== null && otherWant.has(v.s.k)) : v.c !== null && otherWant.has(v.c.k));
        if (otherOk) add(a);
      }
      if (attr === "s" && own && (otherWant.size === 0 || vars.some((v) => v.c !== null && otherWant.has(v.c.k)))) add(own);
    }
    const opts = [...m].map(([key, g]) => ({ key, name: [...g.names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))[0][0], count: g.count, selected: want.has(key) }));
    for (const k of want) if (!m.has(k)) opts.push({ key: k, name: attr === "s" ? parseSize(k.replace("x", " x "))?.n ?? k : k, count: 0, selected: true });
    return opts;
  };
  const c = tally("c", sizes, colors).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));
  const z = tally("s", colors, sizes).sort((a, b) => cmpPair(sizeNums(a.key), sizeNums(b.key)));
  return { colors: c, sizes: z };
}
