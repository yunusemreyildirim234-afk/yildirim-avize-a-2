/** Saf sayfalama yardımcıları (kategori sayfası). */
export const PAGE_SIZE = 24; // varsayılan sayfa boyutu (tek sabit)
export const PAGE_SIZES = [24, 48, 96] as const;
export const ALL_MAX = 200; // "Tümü" en fazla bu kadar ürün
export const PAGE_PARAM = "sayfa";
export const SIZE_PARAM = "adet";

export type Adet = "24" | "48" | "96" | "tumu";

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw);

/** ?adet= değerini ayrıştırır; geçersiz → varsayılan (24). `canonical`: parametrede yazılması gereken değer (varsayılan için undefined). */
export function parseAdet(raw: string | string[] | undefined): { adet: Adet; size: number; canonical: Adet | undefined } {
  const v = first(raw)?.trim();
  const adet: Adet = v === "48" || v === "96" || v === "tumu" ? v : "24";
  return { adet, size: sizeOfAdet(adet), canonical: adet === "24" ? undefined : adet };
}

export const sizeOfAdet = (adet: Adet) => (adet === "tumu" ? ALL_MAX : Number(adet));

/** ?sayfa= değerini tam sayıya çevirir; geçersiz (boş, abc, 0, negatif, ondalık) → 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const v = first(raw);
  if (typeof v !== "string" || !/^\d+$/.test(v.trim())) return 1;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export const totalPages = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/** Sınır dışı sayfayı son sayfaya sıkıştırır. */
export const clampPage = (page: number, total: number, size = PAGE_SIZE) => Math.min(Math.max(1, page), totalPages(total, size));

/** Sayfa için görüntülenen aralık: "X-Y / Z". Toplam 0 ise null. */
export function rangeOf(page: number, total: number, size = PAGE_SIZE): { from: number; to: number; total: number } | null {
  if (total <= 0) return null;
  const from = (page - 1) * size + 1;
  return { from, to: Math.min(total, page * size), total };
}

type Params = Record<string, string | string[] | undefined>;

/** Adres: sayfa=1 ve varsayılan adet parametresizdir; diğer sorgu parametreleri korunur. `adet` verilmezse mevcut adet parametresi aynen taşınır. */
export function pageHref(path: string, page: number, params: Params = {}, adet?: Adet): string {
  const q = new URLSearchParams();
  const keepAdet = adet === undefined ? parseAdet(params[SIZE_PARAM]).canonical : adet === "24" ? undefined : adet;
  for (const [k, v] of Object.entries(params)) {
    if (k === PAGE_PARAM || k === SIZE_PARAM || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  if (keepAdet) q.set(SIZE_PARAM, keepAdet);
  if (page > 1) q.set(PAGE_PARAM, String(page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Sayfa boyutu değişince aynı ürün civarında kalmak için yeni sayfa; "Tümü" → 1 (parametresiz). */
export function mapPage(oldPage: number, oldSize: number, newAdet: Adet): number {
  if (newAdet === "tumu") return 1;
  return Math.floor(((oldPage - 1) * oldSize) / sizeOfAdet(newAdet)) + 1;
}

/** "Sayfa başına" bağlantısı: yeni adet + eşlenen sayfa; diğer parametreler korunur. */
export function adetHref(path: string, newAdet: Adet, currentPage: number, currentSize: number, params: Params = {}): string {
  return pageHref(path, mapPage(currentPage, currentSize, newAdet), params, newAdet);
}

/** "1 2 3 … N" öğeleri: ilk, son ve geçerli sayfanın ±1 komşusu; aradaki boşluk "gap". */
export function pageItems(current: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * İstek kanonik değilse (geçersiz/sınır dışı sayfa, sayfa=1, adet=24 veya geçersiz adet) gidilecek { page, adet }; zaten kanonikse null.
 * Sınır dışı sayfa son sayfaya, geçersiz adet varsayılana döner.
 */
export function canonicalListing(query: Params, total: number): { page: number; adet: Adet } | null {
  const { adet, size, canonical } = parseAdet(query[SIZE_PARAM]);
  const page = clampPage(parsePage(query[PAGE_PARAM]), total, size);
  const gotAdet = first(query[SIZE_PARAM]);
  const gotPage = first(query[PAGE_PARAM]);
  const pageOk = gotPage === (page === 1 ? undefined : String(page));
  const adetOk = gotAdet === canonical;
  return pageOk && adetOk ? null : { page, adet };
}
