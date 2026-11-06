// Ortak ürün listesi (/arama ve /kategori/[slug]) için SAF sıralama + filtre çekirdeği: veritabanı ve Next bağımlılığı yok (birim test edilebilir).
import { categoryKey, slugifyTr } from "./categories.ts";

export const SORTS = ["onerilen", "fiyat-artan", "fiyat-azalan", "cok-satan", "one-cikan", "en-yeni"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  onerilen: "Önerilen",
  "fiyat-artan": "Fiyat: Düşükten yükseğe",
  "fiyat-azalan": "Fiyat: Yüksekten düşüğe",
  "cok-satan": "Çok satanlar",
  "one-cikan": "Öne çıkanlar",
  "en-yeni": "En yeni",
};

/** Sınırlar: URL'den gelen listeler bu kadar eleman ve karakterle kırpılır. */
export const MAX_FILTER_ITEMS = 12;
const MAX_TOKEN_LEN = 48;
const MAX_PRICE = 10_000_000;

export interface ListingState {
  siralama: Sort;
  kategoriler: string[]; // kategori slug'ları
  renkler: string[]; // renk anahtarları (colorKey)
  fiyatMin?: number;
  fiyatMax?: number;
}

export interface ListingRow {
  id: string;
  /** categoryKey(ürün kategorisi) */
  cat: string;
  /** Kartta gösterilen fiyat (Product.basePrice) */
  price: number;
  created: number;
  updated: number;
  featured: boolean;
  colors: { k: string; n: string }[];
}

export interface CatMeta {
  key: string;
  slug: string;
  title: string;
}

type Params = Record<string, string | string[] | undefined>;
const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Tekrarlı (?kategori=a&kategori=b) ve virgüllü (?kategori=a,b) biçimleri; yalnızca [a-z0-9-], sınırlı uzunluk/sayı, tekrarsız. */
function tokens(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((x) => (typeof x === "string" ? x.slice(0, 600).split(",") : []));
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim().toLowerCase();
    if (t && t.length <= MAX_TOKEN_LEN && /^[a-z0-9-]+$/.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= MAX_FILTER_ITEMS) break;
  }
  return out;
}

function parsePrice(raw: string | string[] | undefined): number | undefined {
  const v = firstOf(raw)?.trim();
  if (!v || v.length > 12 || !/^\d{1,8}([.,]\d{1,2})?$/.test(v)) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? n : undefined;
}

/** Ham sorgudan durum; geçersiz her değer sessizce varsayılana düşer (hata yok). Kategori/renk değerleri sonradan evrene göre doğrulanır (applyListing). */
export function parseListingParams(query: Params): ListingState {
  const s = firstOf(query.siralama)?.trim();
  let fiyatMin = parsePrice(query.fiyat_min);
  let fiyatMax = parsePrice(query.fiyat_max);
  if (fiyatMin !== undefined && fiyatMax !== undefined && fiyatMin > fiyatMax) [fiyatMin, fiyatMax] = [fiyatMax, fiyatMin];
  return {
    siralama: (SORTS as readonly string[]).includes(s ?? "") ? (s as Sort) : "onerilen",
    kategoriler: tokens(query.kategori),
    renkler: tokens(query.renk),
    ...(fiyatMin !== undefined ? { fiyatMin } : {}),
    ...(fiyatMax !== undefined ? { fiyatMax } : {}),
  };
}

export const isDefaultState = (s: ListingState) => s.siralama === "onerilen" && !hasFilters(s);
export const hasFilters = (s: ListingState) => s.kategoriler.length > 0 || s.renkler.length > 0 || s.fiyatMin !== undefined || s.fiyatMax !== undefined;

const num = (n: number) => String(Number.isInteger(n) ? n : Math.round(n * 100) / 100);

/** Durumu adres parametrelerine çevirir (varsayılanlar yazılmaz; sabit sıra). Sayfa/adet çağıranda eklenir. */
export function stateToParams(s: ListingState): Record<string, string> {
  const o: Record<string, string> = {};
  if (s.siralama !== "onerilen") o.siralama = s.siralama;
  if (s.kategoriler.length) o.kategori = s.kategoriler.join(",");
  if (s.renkler.length) o.renk = s.renkler.join(",");
  if (s.fiyatMin !== undefined) o.fiyat_min = num(s.fiyatMin);
  if (s.fiyatMax !== undefined) o.fiyat_max = num(s.fiyatMax);
  return o;
}

// ---- Renk ----

/** Ürün renkleri yönetimde serbest metindir. "Bej (0146)" ve "Bej" aynı renktir: rakam içeren parantez (kod) atılır. Parantezsiz/harfli parantez korunur. */
export function colorName(value: string): string {
  return value.replace(/\s*\([^)]*\d[^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

const PLACEHOLDER_COLORS = new Set(["standart", "tek-renk", "tek-secenek", "secenek", "default", "yok", "std"]);

/** Renk anahtarı (ASCII slug); boş/yer tutucu değerde null. */
export function colorKey(value: string): string | null {
  const name = colorName(value);
  if (!name) return null;
  const key = slugifyTr(categoryKey(name)).slice(0, MAX_TOKEN_LEN);
  return key === "kategori" || PLACEHOLDER_COLORS.has(key) ? null : key;
}

// Yalnızca renk örneği (nokta) için; filtreleme anahtarla yapılır. Listede olmayan renk: eğik çizgili nötr örnek.
const HEX: Record<string, string> = {
  siyah: "#1c1917", beyaz: "#fafaf9", bej: "#d6c7a8", krem: "#efe4c8", gold: "#c9a227", altin: "#c9a227", sari: "#e3b505",
  krom: "#b8bcc2", gumus: "#b8bcc2", nikel: "#a7adb4", antrasit: "#44484d", gri: "#8b9096", bronz: "#8c6a3c", bakir: "#b4683c",
  antik: "#8c6a3c", kahverengi: "#6b4a2f", ceviz: "#6b4a2f", kirmizi: "#b91c1c", mavi: "#1d4ed8", yesil: "#15803d", seffaf: "#e7e5e4",
  naturel: "#c8a97e", ahsap: "#a47c4f", pembe: "#d9a1ad", mor: "#6d4c8c", turuncu: "#d9731a",
};
export function colorSwatch(key: string): string | null {
  for (const part of key.split("-")) if (HEX[part]) return HEX[part];
  return null;
}

// ---- Uygulama ----

export interface ListingFacets {
  categories: { slug: string; title: string; count: number; selected: boolean }[];
  colors: { key: string; name: string; count: number; selected: boolean }[];
  /** Kategori ve renk filtrelerine uyan ürünlerin fiyat aralığı (tam sayıya yuvarlı); ürün yoksa null */
  price: { min: number; max: number } | null;
}

export interface ListingResult {
  /** Doğrulanmış durum (evrende olmayan kategori/renk atılmış) */
  state: ListingState;
  /** Filtrelenmiş ve sıralanmış tüm ürün kimlikleri */
  ids: string[];
  total: number;
  facets: ListingFacets;
}

/**
 * Satırlar VARSAYILAN sırada verilir (arama: alaka/güncellik, kategori: vitrin sırası). `rankIds`: çok satan sırası (çoktan aza kimlikler).
 * Filtre sayıları standart facet davranışıdır: her grup, KENDİSİ hariç diğer aktif filtrelere göre sayılır.
 * Her sıralamada eşitlik kararlı ikincil sırayla (varsayılan sıra / id) çözülür.
 */
export function applyListing(rows: readonly ListingRow[], raw: ListingState, ctx: { cats: readonly CatMeta[]; rankIds?: readonly string[] }): ListingResult {
  const catByKey = new Map(ctx.cats.map((c) => [c.key, c]));
  const universeSlugs = new Set<string>();
  const universeColors = new Set<string>();
  for (const r of rows) {
    const c = catByKey.get(r.cat);
    if (c) universeSlugs.add(c.slug);
    for (const col of r.colors) universeColors.add(col.k);
  }
  const state: ListingState = { ...raw, kategoriler: raw.kategoriler.filter((s) => universeSlugs.has(s)), renkler: raw.renkler.filter((k) => universeColors.has(k)) };
  const wantCats = new Set(state.kategoriler);
  const wantColors = new Set(state.renkler);

  const okCat = (r: ListingRow) => wantCats.size === 0 || wantCats.has(catByKey.get(r.cat)?.slug ?? "");
  const okColor = (r: ListingRow) => wantColors.size === 0 || r.colors.some((c) => wantColors.has(c.k));
  const okPrice = (r: ListingRow) => (state.fiyatMin === undefined || r.price >= state.fiyatMin) && (state.fiyatMax === undefined || r.price <= state.fiyatMax);

  // Sıralama: tüm satırlar üzerinde anahtar hesabı, sonra filtre (filtre sırayı bozmaz)
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  const rank = new Map((ctx.rankIds ?? []).map((id, i) => [id, i]));
  const byIdx = (a: ListingRow, b: ListingRow) => idx.get(a.id)! - idx.get(b.id)!;
  const cmp: Record<Sort, (a: ListingRow, b: ListingRow) => number> = {
    onerilen: byIdx,
    "fiyat-artan": (a, b) => a.price - b.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    "fiyat-azalan": (a, b) => b.price - a.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    "cok-satan": (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || byIdx(a, b),
    "one-cikan": (a, b) => Number(b.featured) - Number(a.featured) || byIdx(a, b),
    "en-yeni": (a, b) => b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  };
  const sorted = [...rows].sort((a, b) => {
    const d = cmp[state.siralama](a, b);
    return Number.isNaN(d) || d === 0 ? byIdx(a, b) : d; // Infinity - Infinity = NaN → varsayılan sıra
  });
  const matched = sorted.filter((r) => okCat(r) && okColor(r) && okPrice(r));

  // Facetler
  const catCount = new Map<string, number>();
  const colorCount = new Map<string, { n: Map<string, number>; count: number }>();
  let pMin = Infinity;
  let pMax = -Infinity;
  for (const r of rows) {
    const cat = okColor(r) && okPrice(r);
    if (cat) {
      const c = catByKey.get(r.cat);
      if (c) catCount.set(c.slug, (catCount.get(c.slug) ?? 0) + 1);
    }
    if (okCat(r) && okPrice(r)) {
      for (const k of new Set(r.colors.map((c) => c.k))) {
        const g = colorCount.get(k) ?? { n: new Map<string, number>(), count: 0 };
        g.count += 1;
        for (const c of r.colors) if (c.k === k) g.n.set(c.n, (g.n.get(c.n) ?? 0) + 1);
        colorCount.set(k, g);
      }
    }
    if (okCat(r) && okColor(r)) {
      pMin = Math.min(pMin, r.price);
      pMax = Math.max(pMax, r.price);
    }
  }
  const categories = ctx.cats
    .filter((c) => universeSlugs.has(c.slug) && ((catCount.get(c.slug) ?? 0) > 0 || wantCats.has(c.slug)))
    .map((c) => ({ slug: c.slug, title: c.title, count: catCount.get(c.slug) ?? 0, selected: wantCats.has(c.slug) }));
  const colors = [...colorCount]
    .map(([key, g]) => ({ key, name: [...g.n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))[0][0], count: g.count, selected: wantColors.has(key) }))
    .concat([...wantColors].filter((k) => !colorCount.has(k)).map((key) => ({ key, name: key, count: 0, selected: true })))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));

  return {
    state,
    ids: matched.map((r) => r.id),
    total: matched.length,
    facets: { categories, colors, price: Number.isFinite(pMin) ? { min: Math.floor(pMin), max: Math.ceil(pMax) } : null },
  };
}
