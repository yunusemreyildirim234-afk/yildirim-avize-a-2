/** Saf sayfalama yardımcıları (kategori sayfası). Sayfa boyutu tek sabit. */
export const PAGE_SIZE = 24;
export const PAGE_PARAM = "sayfa";

/** ?sayfa= değerini tam sayıya çevirir; geçersiz (boş, abc, 0, negatif, ondalık) → 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || !/^\d+$/.test(v.trim())) return 1;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export const totalPages = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** Sınır dışı sayfayı son sayfaya sıkıştırır. */
export const clampPage = (page: number, total: number) => Math.min(Math.max(1, page), totalPages(total));

/** Sayfa için görüntülenen aralık: "X-Y / Z". Toplam 0 ise null. */
export function rangeOf(page: number, total: number): { from: number; to: number; total: number } | null {
  if (total <= 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  return { from, to: Math.min(total, page * PAGE_SIZE), total };
}

/** Sayfa adresi: sayfa=1 parametresizdir; diğer sorgu parametreleri (süzgeç/sıralama) korunur. */
export function pageHref(path: string, page: number, params: Record<string, string | string[] | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === PAGE_PARAM || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  if (page > 1) q.set(PAGE_PARAM, String(page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
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

/** İstek adresi kanonik değilse (geçersiz/sınır dışı/sayfa=1) gidilecek kanonik sayfa; zaten kanonikse null. */
export function canonicalPage(raw: string | string[] | undefined, total: number): number | null {
  const wanted = clampPage(parsePage(raw), total);
  const given = Array.isArray(raw) ? raw[0] : raw;
  const canonicalRaw = wanted === 1 ? undefined : String(wanted);
  return given === canonicalRaw ? null : wanted;
}
