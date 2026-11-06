// Ortak ürün listesi (/arama ve /kategori/[slug]) için SAF sıralama + filtre çekirdeği: veritabanı ve Next bağımlılığı yok (birim test edilebilir).
import { categoryKey, slugifyTr } from "./categories.ts";

export const SORTS = ["onerilen", "fiyat-artan", "fiyat-azalan", "ebat-artan", "ebat-azalan", "cok-satan", "one-cikan", "en-yeni"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  onerilen: "Önerilen",
  "fiyat-artan": "Fiyat: Düşükten yükseğe",
  "fiyat-azalan": "Fiyat: Yüksekten düşüğe",
  "ebat-artan": "Ebat: Küçükten büyüğe",
  "ebat-azalan": "Ebat: Büyükten küçüğe",
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
  ebatlar: string[]; // ebat anahtarları ("45x25")
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
  /** Her varyasyonun renk ve ebatı (ikisi birlikte seçilince AYNI varyasyonda eşleşmeleri gerekir) */
  vars: VariationAttrs[];
  /** Product.ebat (ürün düzeyi; tüm varyasyonlar için geçerli sayılır); yoksa null */
  own?: Attr | null;
}

export interface Attr {
  k: string;
  n: string;
}
export interface VariationAttrs {
  c: Attr | null;
  s: Attr | null;
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

const MAX_SIZE_LEN = 24;
/** Ebat adres değeri: "45x25" (boşluk/×/X tolere edilir, ondalık yalnızca nokta). Geçersizler sessizce atılır. */
function sizeTokens(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((x) => (typeof x === "string" ? x.slice(0, 600).split(",") : []));
  const out: string[] = [];
  for (const p of parts) {
    const t = p.toLowerCase().replace(/\s+/g, "").replace(/×/g, "x");
    if (t && t.length <= MAX_SIZE_LEN && /^\d{1,4}(\.\d{1,2})?x\d{1,4}(\.\d{1,2})?$/.test(t) && !out.includes(t)) out.push(t);
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
    ebatlar: sizeTokens(query.ebat),
    ...(fiyatMin !== undefined ? { fiyatMin } : {}),
    ...(fiyatMax !== undefined ? { fiyatMax } : {}),
  };
}

export const isDefaultState = (s: ListingState) => s.siralama === "onerilen" && !hasFilters(s);
export const hasFilters = (s: ListingState) => s.kategoriler.length > 0 || s.renkler.length > 0 || s.ebatlar.length > 0 || s.fiyatMin !== undefined || s.fiyatMax !== undefined;

const num = (n: number) => String(Number.isInteger(n) ? n : Math.round(n * 100) / 100);

/** Durumu adres parametrelerine çevirir (varsayılanlar yazılmaz; sabit sıra). Sayfa/adet çağıranda eklenir. */
export function stateToParams(s: ListingState): Record<string, string> {
  const o: Record<string, string> = {};
  if (s.siralama !== "onerilen") o.siralama = s.siralama;
  if (s.kategoriler.length) o.kategori = s.kategoriler.join(",");
  if (s.renkler.length) o.renk = s.renkler.join(",");
  if (s.ebatlar.length) o.ebat = s.ebatlar.join(",");
  if (s.fiyatMin !== undefined) o.fiyat_min = num(s.fiyatMin);
  if (s.fiyatMax !== undefined) o.fiyat_max = num(s.fiyatMax);
  return o;
}

// ---- Renk ----

/** Yönetimin yazdığı "Renk" türü: "Bej (0146)" ve "Bej" aynı renktir; rakam içeren parantez (kod) atılır. Parantezsiz/harfli parantez korunur. */
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

/**
 * Trendyol'dan gelen "Seçenek" türünde YALNIZCA bu adlar renk sayılır (liste dışı ilk parça renk değildir: "3'lü", "E14 duy", "45 x 25" ...).
 * Genişletmek için yalnızca buraya ekleyin (küçük harf, tr-TR). Altın / Gold / Lak gold bilerek ayrı seçeneklerdir.
 */
export const SECENEK_COLOR_ALLOWLIST: readonly string[] = [
  "bej", "sarı", "siyah", "beyaz", "krem", "gri", "kahverengi", "kırmızı", "pembe", "mor", "lila", "mavi", "yeşil", "turuncu", "bal", "şeffaf",
  "çok renkli", "metalik", "gümüş", "altın", "gold", "lak gold", "krom", "eskitme", "pirinç eskitme", "antik", "bakır", "bronz", "nikel", "füme",
  "lacivert", "bordo", "turkuaz", "haki", "antrasit", "ceviz", "naturel", "gül kurusu",
  "mat siyah", "bakır lak", "lak kaplama platin", "okyanus mavisi", "mürdüm", "şampanya", "pirinç eskitme (elektrostatik)",
  // "cam" ve "ahşap" malzemedir, renk DEĞİL: bilerek yok (ebatları yine okunur).
];
const ALLOW = new Set(SECENEK_COLOR_ALLOWLIST);
/** Bilinen yazım hataları (kelime bazlı, küçük harf) */
const SPELLING: Record<string, string> = { prinç: "pirinç" };
/** Tek eş anlam birleştirmesi (tüm ad bazlı, küçük harf): izin listesine girmeden önce uygulanır. Başka birleştirme yapılmaz. */
const ALIAS: Record<string, string> = { kahve: "kahverengi" };

const lowerTr = (s: string) => s.toLocaleLowerCase("tr-TR");
// Her kelimenin (parantez içindekiler dahil) ilk harfi büyük
const titleTr = (s: string) => s.replace(/(^|[\s(])(\p{L})/gu, (_m, p: string, c: string) => p + c.toLocaleUpperCase("tr-TR"));

/** "Seçenek" türü ilk parçası → izinli renk adı (küçük harf) ya da null */
export function secenekColorName(part: string): string | null {
  const s = lowerTr(part)
    .replace(/\s*\([^)]*\d[^)]*\)/g, "")
    .replace(/^[\s,;.]+|[\s,;.]+$/g, "")
    .split(/\s+/)
    .map((w) => SPELLING[w] ?? w)
    .join(" ");
  const name = ALIAS[s] ?? s;
  return ALLOW.has(name) ? name : null;
}

const SIZE_RE = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,2})?)$/;
/** "45 x 25" / "50x50" / "12 X 12" / "12,5 x 10" → { k: "45x25", n: "45 x 25" }; kalıba uymayan null. Birim bilinmez (etiket yalnızca "Ebat"). */
export function parseSize(part: string): Attr | null {
  const m = SIZE_RE.exec(part.trim());
  if (!m) return null;
  const a = Number(m[1].replace(",", "."));
  const b = Number(m[2].replace(",", "."));
  if (!(a > 0) || !(b > 0)) return null;
  const show = (n: number) => String(n).replace(".", ",");
  return { k: `${a}x${b}`, n: `${show(a)} x ${show(b)}` };
}

export const MAX_EBAT_LEN = 24;
/**
 * Yönetici girişi (Product.ebat): "45x25" / "45 X 25" / "45 × 25" / "12,5 x 10" → "45 x 25" / "12,5 x 10". Boş = alanı temizle (değer null).
 * Kalıba uymayan ("E27", "45", "45 cm", "45 x 25 x 10") reddedilir. Sunucuda zorunlu doğrulama için kullanılır.
 */
export function normalizeEbat(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "Ebat metin olmalıdır." };
  const t = input.trim();
  if (!t) return { ok: true, value: null };
  if (t.length > MAX_EBAT_LEN) return { ok: false, error: `Ebat en çok ${MAX_EBAT_LEN} karakter olabilir.` };
  const a = parseSize(t);
  if (!a) return { ok: false, error: "Ebat \"en x boy\" biçiminde olmalıdır (örn. 45 x 25). Birim ve ek ölçü yazmayın." };
  return { ok: true, value: a.n };
}

/** Ebat anahtarı "45x25" → (büyük kenar, küçük kenar) */
const sizeSortKey = (k: string): [number, number] => {
  const [a, b] = k.split("x").map(Number);
  return a >= b ? [a, b] : [b, a];
};
const cmpKey = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];

const PART_SPLIT = /\s+\/\s+/;

/**
 * Bir varyasyonun renk ve ebatı. Değer kalıbı "Renk" ya da "Renk / EnxBoy"; ölçü kısmı renk değildir.
 * - "Renk" türü (yönetici girişi): olduğu gibi kabul edilir; yalnızca ikinci parça ebat kalıbındaysa ilk parça alınır.
 * - "Seçenek" türü (Trendyol): ilk parça izin listesinde ise renktir.
 * - Ebat her iki türde de ikinci parçadan okunur.
 */
export function variationAttrs(type: string, value: string): VariationAttrs {
  const parts = value.split(PART_SPLIT).map((p) => p.trim());
  const s = parts.length > 1 ? parseSize(parts[1]) : null;
  let c: Attr | null = null;
  if (type === "Renk") {
    const v = s ? parts[0] : value;
    const k = colorKey(v);
    if (k) c = { k, n: colorName(v) };
  } else if (type === "Seçenek") {
    const name = secenekColorName(parts[0]);
    const k = name ? colorKey(name) : null;
    if (name && k) c = { k, n: titleTr(name) };
  }
  return { c, s: type === "Renk" || type === "Seçenek" ? s : null };
}

/** Geliştirici denetimi: ham "Seçenek" değerlerinden renk sayılmayan ilk parçalar ve ebat olmayan ikinci parçalar (sayılarıyla). Veritabanına bağlanmaz. */
export function auditSecenekValues(values: readonly string[]) {
  const unlisted = new Map<string, number>();
  const nonSize = new Map<string, number>();
  for (const v of values) {
    const parts = v.split(PART_SPLIT).map((p) => p.trim());
    const first = lowerTr(parts[0]);
    if (!secenekColorName(parts[0])) unlisted.set(first, (unlisted.get(first) ?? 0) + 1);
    if (parts.length > 1 && !parseSize(parts[1])) nonSize.set(lowerTr(parts[1]), (nonSize.get(lowerTr(parts[1])) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  return { unlistedFirstParts: top(unlisted), nonSizeSecondParts: top(nonSize) };
}

// Yalnızca renk örneği (nokta) için; filtreleme anahtarla yapılır. Listede olmayan renk: eğik çizgili nötr örnek.
const HEX: Record<string, string> = {
  lila: "#b39ddb", bal: "#c98a2b", metalik: "#9aa1a9", eskitme: "#7a5c3a", pirinc: "#b08d3c", fume: "#5b5e63", lacivert: "#1e2a4a",
  bordo: "#6d1f2c", turkuaz: "#1b9aaa", haki: "#6b6b3a", gul: "#c98a96", kurusu: "#c98a96",
  siyah: "#1c1917", beyaz: "#fafaf9", bej: "#d6c7a8", krem: "#efe4c8", gold: "#c9a227", altin: "#c9a227", sari: "#e3b505",
  krom: "#b8bcc2", gumus: "#b8bcc2", nikel: "#a7adb4", antrasit: "#44484d", gri: "#8b9096", bronz: "#8c6a3c", bakir: "#b4683c",
  antik: "#8c6a3c", kahverengi: "#6b4a2f", ceviz: "#6b4a2f", kirmizi: "#b91c1c", mavi: "#1d4ed8", yesil: "#15803d", seffaf: "#e7e5e4",
  naturel: "#c8a97e", ahsap: "#a47c4f", pembe: "#d9a1ad", mor: "#6d4c8c", turuncu: "#d9731a",
};
// Bileşik anahtarlar önce tam aranır, sonra parça parça; "cok-renkli" tek renk olmadığı için örneksizdir (nötr).
// ("mat-siyah" ve "bakir-lak" parça aramasıyla siyah/bakır tonunu alır.)
const HEX_FULL: Record<string, string> = {
  "pirinc-eskitme": "#9a7a3a", "pirinc-eskitme-elektrostatik": "#9a7a3a", "lak-gold": "#c9a227",
  "lak-kaplama-platin": "#c4c7cc", "okyanus-mavisi": "#2a6f97", murdum: "#5b2a4a", sampanya: "#e8d5a8",
};
export function colorSwatch(key: string): string | null {
  if (HEX_FULL[key]) return HEX_FULL[key];
  if (key === "cok-renkli") return null;
  for (const part of key.split("-")) if (HEX[part]) return HEX[part];
  return null;
}

// ---- Uygulama ----

export interface ListingFacets {
  categories: { slug: string; title: string; count: number; selected: boolean }[];
  colors: { key: string; name: string; count: number; selected: boolean }[];
  /** Ebatlar (ürün sayısına göre azalan); boşsa bölüm gösterilmez */
  sizes: { key: string; name: string; count: number; selected: boolean }[];
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
  const universeSizes = new Set<string>();
  for (const r of rows) {
    const c = catByKey.get(r.cat);
    if (c) universeSlugs.add(c.slug);
    for (const v of r.vars) {
      if (v.c) universeColors.add(v.c.k);
      if (v.s) universeSizes.add(v.s.k);
    }
    if (r.own) universeSizes.add(r.own.k);
  }
  const state: ListingState = {
    ...raw,
    kategoriler: raw.kategoriler.filter((s) => universeSlugs.has(s)),
    renkler: raw.renkler.filter((k) => universeColors.has(k)),
    ebatlar: raw.ebatlar.filter((k) => universeSizes.has(k)),
  };
  const wantCats = new Set(state.kategoriler);
  const wantColors = new Set(state.renkler);
  const wantSizes = new Set(state.ebatlar);

  const okCat = (r: ListingRow) => wantCats.size === 0 || wantCats.has(catByKey.get(r.cat)?.slug ?? "");
  // Yalnızca biri seçiliyse ürün düzeyinde eşleşme; ikisi birlikte seçiliyse AYNI varyasyon hem rengi hem ebatı taşımalıdır.
  // Ürün düzeyindeki ebat (Product.ebat) o ürünün her varyasyonu için geçerli sayılır; varyasyon ebatları AYNI varyasyon kuralıyla eşleşir.
  const ownHit = (r: ListingRow) => r.own != null && wantSizes.has(r.own.k);
  const sizeOk = (r: ListingRow, v: VariationAttrs) => wantSizes.size === 0 || ownHit(r) || (v.s !== null && wantSizes.has(v.s.k));
  const colorOk = (v: VariationAttrs) => wantColors.size === 0 || (v.c !== null && wantColors.has(v.c.k));
  const okColor = (r: ListingRow) =>
    (wantColors.size === 0 && wantSizes.size === 0) || (wantColors.size === 0 && ownHit(r)) || r.vars.some((v) => colorOk(v) && sizeOk(r, v));
  const okPrice = (r: ListingRow) => (state.fiyatMin === undefined || r.price >= state.fiyatMin) && (state.fiyatMax === undefined || r.price <= state.fiyatMax);

  // Sıralama: tüm satırlar üzerinde anahtar hesabı, sonra filtre (filtre sırayı bozmaz)
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  const rank = new Map((ctx.rankIds ?? []).map((id, i) => [id, i]));
  const byIdx = (a: ListingRow, b: ListingRow) => idx.get(a.id)! - idx.get(b.id)!;
  // Ebat sıralaması: ürünün ebat anahtarları (varyasyon ebatları ∪ Product.ebat); artanda en küçüğü, azalanda en büyüğü; ebatsızlar iki yönde de sonda.
  const sizeKeys = new Map(
    rows.map((r) => {
      const ks = [...r.vars.flatMap((v) => (v.s ? [v.s.k] : [])), ...(r.own ? [r.own.k] : [])].map(sizeSortKey);
      return [r.id, ks.sort(cmpKey)] as const;
    })
  );
  const byId = (a: ListingRow, b: ListingRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const bySize = (dir: 1 | -1) => (a: ListingRow, b: ListingRow) => {
    const ka = sizeKeys.get(a.id)!;
    const kb = sizeKeys.get(b.id)!;
    if (!ka.length || !kb.length) return ka.length === kb.length ? byId(a, b) : ka.length ? -1 : 1;
    const pick = (ks: [number, number][]) => (dir === 1 ? ks[0] : ks[ks.length - 1]);
    return dir * cmpKey(pick(ka), pick(kb)) || byId(a, b);
  };
  const cmp: Record<Sort, (a: ListingRow, b: ListingRow) => number> = {
    onerilen: byIdx,
    "fiyat-artan": (a, b) => a.price - b.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    "fiyat-azalan": (a, b) => b.price - a.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    "ebat-artan": bySize(1),
    "ebat-azalan": bySize(-1),
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
  // Renk/ebat sayısı: o grup KENDİ filtresi hariç sayılır; diğer grup seçiliyse AYNI varyasyonda eşleşme aranır. Ürün başına bir kez.
  const tally = (attr: "c" | "s", otherWant: Set<string>) => {
    const m = new Map<string, { n: Map<string, number>; count: number }>();
    for (const r of rows) {
      if (!okCat(r) || !okPrice(r)) continue;
      const seen = new Set<string>();
      const add = (a: Attr) => {
        const g = m.get(a.k) ?? { n: new Map<string, number>(), count: 0 };
        g.n.set(a.n, (g.n.get(a.n) ?? 0) + 1);
        if (!seen.has(a.k)) {
          seen.add(a.k);
          g.count += 1;
        }
        m.set(a.k, g);
      };
      for (const v of r.vars) {
        const a = v[attr];
        if (!a) continue;
        // Renk sayılırken ürün düzeyi ebat da "diğer grup" eşleşmesi sayılır; ebat sayılırken diğer grup renktir (ebat varyasyonun renginden bağımsız değerlendirilir).
        const otherOk = otherWant.size === 0 || (attr === "c" ? ownHit(r) || (v.s !== null && otherWant.has(v.s.k)) : v.c !== null && otherWant.has(v.c.k));
        if (otherOk) add(a);
      }
      // Ürün düzeyi ebat: renk seçiliyse ürünün en az bir rengi eşleşmeli
      if (attr === "s" && r.own && (otherWant.size === 0 || r.vars.some((v) => v.c !== null && otherWant.has(v.c.k)))) add(r.own);
    }
    return m;
  };
  const colorCount = tally("c", wantSizes);
  const sizeCount = tally("s", wantColors);
  let pMin = Infinity;
  let pMax = -Infinity;
  for (const r of rows) {
    const cat = okColor(r) && okPrice(r);
    if (cat) {
      const c = catByKey.get(r.cat);
      if (c) catCount.set(c.slug, (catCount.get(c.slug) ?? 0) + 1);
    }
    if (okCat(r) && okColor(r)) {
      pMin = Math.min(pMin, r.price);
      pMax = Math.max(pMax, r.price);
    }
  }
  const categories = ctx.cats
    .filter((c) => universeSlugs.has(c.slug) && ((catCount.get(c.slug) ?? 0) > 0 || wantCats.has(c.slug)))
    .map((c) => ({ slug: c.slug, title: c.title, count: catCount.get(c.slug) ?? 0, selected: wantCats.has(c.slug) }));
  const toList = (m: Map<string, { n: Map<string, number>; count: number }>, want: Set<string>) =>
    [...m]
      .map(([key, g]) => ({ key, name: [...g.n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))[0][0], count: g.count, selected: want.has(key) }))
      .concat([...want].filter((k) => !m.has(k)).map((key) => ({ key, name: key, count: 0, selected: true })));
  const colors = toList(colorCount, wantColors).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));
  const sizeDims = (k: string) => k.split("x").map(Number);
  const sizes = toList(sizeCount, wantSizes)
    .map((z) => ({ ...z, name: z.name === z.key ? parseSize(z.key.replace("x", " x "))?.n ?? z.key : z.name }))
    .sort((a, b) => b.count - a.count || sizeDims(a.key)[0] - sizeDims(b.key)[0] || sizeDims(a.key)[1] - sizeDims(b.key)[1]);

  return {
    state,
    ids: matched.map((r) => r.id),
    total: matched.length,
    facets: { categories, colors, sizes, price: Number.isFinite(pMin) ? { min: Math.floor(pMin), max: Math.ceil(pMax) } : null },
  };
}
