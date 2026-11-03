// Admin ürün listesi "Seçilenler" paneli için saf yardımcılar (React/ağ yok; test edilebilir).
// Seçim, ürün KİMLİKLERİNDEN oluşan bir kümedir: süzgeç, arama, sayfalama ("Daha fazla göster") görünümü değiştirse de seçim korunur.

export const CHIP_LIMIT = 12;

export function toggleId(sel: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(sel);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const removeId = (sel: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(sel);
  next.delete(id);
  return next;
};

/** "Filtredeki tümünü seç": görünmeyen (başka süzgeçteki) seçimler KORUNUR, yalnızca eklenir. */
export const addAll = (sel: ReadonlySet<string>, ids: string[]): Set<string> => new Set([...sel, ...ids]);

/** "Filtredeki tümünü bırak": yalnızca verilen kimlikler çıkar; süzgeç dışındaki seçimler kalır. */
export const removeAll = (sel: ReadonlySet<string>, ids: string[]): Set<string> => {
  const drop = new Set(ids);
  return new Set([...sel].filter((id) => !drop.has(id)));
};

/** Çip etiketi: kısaltılmış ad + model kodu. */
export function chipLabel(title: string, modelCode: string | null | undefined, max = 22): string {
  const t = title.trim();
  const short = t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  const code = modelCode?.trim();
  return code ? `${short} · #${code}` : short;
}

/** İlk `limit` çip gösterilir; kalan "+N daha". expanded=true tümünü gösterir. */
export function visibleChips<T>(items: T[], expanded: boolean, limit = CHIP_LIMIT): { shown: T[]; more: number } {
  if (expanded || items.length <= limit) return { shown: items, more: 0 };
  return { shown: items.slice(0, limit), more: items.length - limit };
}

/** Satır, görünür alanın (yapışık başlığın altı ile pencere altı arasının) dışında mı? */
export function isOffscreen(rect: { top: number; bottom: number }, viewportH: number, headerH: number): boolean {
  return rect.bottom <= headerH || rect.top >= viewportH;
}

/** Son seçilen: eklenince o kimlik; çıkarılırsa (o buysa) kümedeki son kimlik, yoksa null. */
export function nextLastId(prevLast: string | null, sel: ReadonlySet<string>, changedId: string): string | null {
  if (sel.has(changedId)) return changedId;
  if (prevLast !== changedId) return prevLast && sel.has(prevLast) ? prevLast : [...sel].pop() ?? null;
  return [...sel].pop() ?? null;
}
