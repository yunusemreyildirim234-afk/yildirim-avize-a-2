// "(TAM MONTAJLIDIR.)" eki: yalnızca GÖSTERİMDE ayıklanır (veri, arama, feed ve URL aynı kalır)
const MONTAJ_RE = /\s*\(\s*tam\s+montajl[ıiIİ]d[ıiIİ]r\.?\s*\)/giu;

/** Kart/ürün başlığı gösterimi: eki ayıklar, varsa montajlı=true döner. Ek yoksa başlığa dokunmaz. */
export function displayTitle(title: string): { title: string; assembled: boolean } {
  if (!MONTAJ_RE.test(title)) return { title, assembled: false };
  MONTAJ_RE.lastIndex = 0;
  const clean = title.replace(MONTAJ_RE, "").replace(/\s{2,}/g, " ").trim();
  return { title: clean || title, assembled: true };
}
