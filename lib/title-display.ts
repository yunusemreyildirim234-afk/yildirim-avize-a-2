// Başlık SONUNDAKİ parantez gruplarından "(Tam montajlı)" / "(TAM MONTAJLIDIR.)" olanı yalnızca GÖSTERİMDE ayıklanır (veri, arama, feed ve URL aynı kalır).
// Art arda birden fazla grup olabilir ("(TAM MONTAJLIDIR.) ( Led Ampuller Hediye)"): yalnızca montajlı grup çıkar, diğerleri aynen kalır.
// Parantez içinde başka bir şey varsa ("( 8+4 )", "(Led Ampul Hediye)") ya da ek başlığın ortasındaysa dokunulmaz.
const TAIL_GROUPS_RE = /(?:\s*\([^()]*\))+\s*$/u;
const GROUP_RE = /\s*\([^()]*\)/gu;
const MONTAJ_GROUP_RE = /^\s*\(\s*tam\s+montajl[ıiIİ](?:d[ıiIİ]r)?\s*\.?\s*\)$/iu;

/** Kart/ürün başlığı gösterimi: sondaki gruplardan montajlıyı ayıklar, varsa assembled=true döner. Ek yoksa başlığa dokunmaz. */
export function displayTitle(title: string): { title: string; assembled: boolean } {
  const tail = TAIL_GROUPS_RE.exec(title);
  if (!tail) return { title, assembled: false };
  const groups = tail[0].match(GROUP_RE) ?? [];
  const rest = groups.filter((g) => !MONTAJ_GROUP_RE.test(g));
  if (rest.length === groups.length) return { title, assembled: false };
  const clean = (title.slice(0, tail.index) + rest.join("")).trim();
  return { title: clean || title, assembled: true };
}
