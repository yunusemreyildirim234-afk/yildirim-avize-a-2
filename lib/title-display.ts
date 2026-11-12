// Başlık SONUNDAKİ "(Tam montajlı)" / "(TAM MONTAJLIDIR.)" eki: yalnızca GÖSTERİMDE ayıklanır (veri, arama, feed ve URL aynı kalır).
// Parantez içinde başka bir şey varsa ("( 8+4 )", "(Led Ampul Hediye)") ya da ek başlığın ortasındaysa dokunulmaz.
const MONTAJ_RE = /\s*\(\s*tam\s+montajl[ıiIİ](?:d[ıiIİ]r)?\s*\.?\s*\)\s*$/iu;

/** Kart/ürün başlığı gösterimi: sondaki eki ayıklar, varsa assembled=true döner. Ek yoksa başlığa dokunmaz. */
export function displayTitle(title: string): { title: string; assembled: boolean } {
  if (!MONTAJ_RE.test(title)) return { title, assembled: false };
  const clean = title.replace(MONTAJ_RE, "").trim();
  return { title: clean || title, assembled: true };
}
