// Yönetim paneli ürün listesi araması (saf kurallar; veritabanı yok, istemcide bellekteki liste üzerinde çalışır).
import { COMPACT_MIN_LEN, compactSearch, isCodeQuery, normalizeSearch } from "./search-rank.ts";

export interface AdminSearchable {
  title: string;
  modelCode?: string | null;
  trendyolMainId?: string | null;
  variations: { stockCode?: string | null; barcode?: string | null }[];
}

const lower = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

/** Mevcut kural aynen: ad (içerir), model kodu (tam), Trendyol ana kodu ve stok kodu/barkod (içerir). Ad ayrıca Türkçe harf duyarsız karşılaştırılır. */
function matchesNormal(p: AdminSearchable, q: string, nq: string): boolean {
  return (
    lower(p.title).includes(q) ||
    (!!nq && normalizeSearch(p.title).includes(nq)) ||
    lower(p.modelCode) === q ||
    lower(p.trendyolMainId).includes(q) ||
    p.variations.some((v) => lower(v.stockCode).includes(q) || lower(v.barcode).includes(q))
  );
}

/** İkinci geçiş: boşluksuz yazım, ad üzerinde ("kristalavize" ↔ "Kristal Avize"); en az COMPACT_MIN_LEN karakter. */
function matchesCompactTitle(p: AdminSearchable, c: string): boolean {
  return compactSearch(normalizeSearch(p.title)).includes(c) || (!!p.modelCode && compactSearch(normalizeSearch(p.modelCode)) === c);
}

/** Arama kutusu süzgeci: önce mevcut kural; hiç sonuç yoksa boşluksuz yazım. Boş sorgu listeyi aynen döner. */
export function searchAdminProducts<P extends AdminSearchable>(list: readonly P[], query: string): P[] {
  const q = lower(query);
  if (!q) return [...list];
  const nq = normalizeSearch(query);
  const first = list.filter((p) => matchesNormal(p, q, nq));
  if (first.length > 0) return first;
  const c = compactSearch(nq);
  return c.length >= COMPACT_MIN_LEN ? list.filter((p) => matchesCompactTitle(p, c)) : first;
}

/** Rakam sorgusunda (varsayılan sıralamada): model kodu tam eşleşen en üstte, sonra stok kodu/barkod tam eşleşen, sonra diğerleri; kararlı. Rakam sorgusu değilse aynen döner. */
export function adminCodeFirst<P extends AdminSearchable>(list: readonly P[], query: string): P[] {
  if (!isCodeQuery(query)) return [...list];
  const n = normalizeSearch(query);
  const tier = (p: AdminSearchable) => {
    if (p.modelCode && normalizeSearch(p.modelCode) === n) return 0;
    return p.variations.some((v) => normalizeSearch(v.stockCode ?? "") === n || normalizeSearch(v.barcode ?? "") === n) ? 1 : 2;
  };
  return list.map((p, i) => ({ p, i, t: tier(p) })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.p);
}
