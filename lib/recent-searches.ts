// Son 5 arama (tarayıcıda, misafir ve üye için aynı). Yalnızca istemcide çağrılır.
const KEY = "ya_recent_searches";
const MAX = 5;

export function getRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

const write = (list: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* depolama kapalı olabilir */
  }
  return list;
};

/** En az 2 karakterlik terimi tekrarsız olarak en başa ekler. */
export function saveRecentSearch(term: string): string[] {
  const t = term.trim().slice(0, 80);
  if (t.length < 2) return getRecentSearches();
  const rest = getRecentSearches().filter((s) => s.toLocaleLowerCase("tr") !== t.toLocaleLowerCase("tr"));
  return write([t, ...rest].slice(0, MAX));
}

export const removeRecentSearch = (term: string) => write(getRecentSearches().filter((s) => s !== term));
export const clearRecentSearches = () => write([]);
