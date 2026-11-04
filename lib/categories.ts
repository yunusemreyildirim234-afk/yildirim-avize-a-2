// Kategori listesi için saf yardımcılar (veritabanından bağımsız; test edilebilir).
// Sabit kategoriler (lib/site.ts CATEGORIES) adı/slug'ı/sırasıyla aynen korunur; yönetim panelinden eklenenler arkasına gelir.

export interface FixedCategory {
  slug: string;
  title: string;
  dbCategory: string;
}

export interface CategoryEntry {
  /** categoryKey(ad): ürünün kategorisiyle eşleştirme anahtarı. */
  key: string;
  slug: string;
  title: string;
  /** Aktif ürün sayısı (varyant yazımlar dahil; sayfadaki sayıyla aynı kümeden gelir). */
  count: number;
  /** Veritabanındaki gerçek yazımlar (kategori IN sorgusu için; harf duyarsız karşılaştırmaya güvenilmez). */
  spellings: string[];
  fixed: boolean;
}

/** Kategori sayfası olarak ayrılmış slug'lar (dinamik kategoriler bunlarla çakışmaz). */
export const RESERVED_SLUGS = ["tum", "one-cikanlar", "indirimli", "cok-satanlar"];

/** Birleştirme anahtarı: boşlukları sadeleştirir, tr-TR küçük harf, ı→i ("YEMEK MASASI" = "Yemek Masası" = "yemek masasi"). */
export const categoryKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR").replace(/ı/g, "i"); // ı→i: "KRISTAL" (ASCII büyük I) = "Kristal"

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** URL slug'ı: Türkçe karakterler çevrilir, "&" gibi özel karakterler temizlenir. Boş kalırsa "kategori". */
export function slugifyTr(s: string): string {
  const out = s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "kategori";
}

export interface MergedCategory {
  key: string;
  name: string;
  count: number;
  spellings: string[];
}

/** Aynı anahtara düşen yazımları tek kategoride toplar; görünen ad en sık kullanılan yazımdır (eşitlikte alfabetik ilk). */
export function mergeCategories(rows: { category: string; count: number }[]): MergedCategory[] {
  const groups = new Map<string, { spell: Map<string, number>; count: number }>();
  for (const r of rows) {
    if (!r.category || !r.category.trim()) continue;
    const key = categoryKey(r.category);
    const g = groups.get(key) ?? { spell: new Map<string, number>(), count: 0 };
    g.spell.set(r.category, (g.spell.get(r.category) ?? 0) + r.count);
    g.count += r.count;
    groups.set(key, g);
  }
  return [...groups].map(([key, g]) => {
    const ordered = [...g.spell].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
    return { key, name: ordered[0][0].trim().replace(/\s+/g, " "), count: g.count, spellings: ordered.map(([s]) => s) };
  });
}

/** Sabit kategoriler (aynı sıra, aynı slug/ad) + sabit olmayanlar ürün sayısına göre azalan sırada. Slug çakışmasına -2, -3 eklenir. */
export function buildCategoryList(rows: { category: string; count: number }[], fixed: readonly FixedCategory[]): CategoryEntry[] {
  const merged = mergeCategories(rows);
  const byKey = new Map(merged.map((m) => [m.key, m]));
  const fixedKeys = new Set(fixed.map((f) => categoryKey(f.dbCategory)));

  // Sabit kategori: ad/slug/sıra aynen; büyük/küçük harf ve boşluk varyantları da aynı kategoriye dahildir (ayrı kayıt çıkmaz)
  const head: CategoryEntry[] = fixed.map((f) => {
    const m = byKey.get(categoryKey(f.dbCategory));
    return {
      key: categoryKey(f.dbCategory),
      slug: f.slug,
      title: f.title,
      count: m?.count ?? 0,
      spellings: [f.dbCategory, ...(m?.spellings ?? []).filter((s) => s !== f.dbCategory)], // kanonik yazım önde
      fixed: true,
    };
  });

  const used = new Set<string>([...fixed.map((f) => f.slug), ...RESERVED_SLUGS]);
  const tail = merged
    .filter((m) => !fixedKeys.has(m.key))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"))
    .map((m): CategoryEntry => {
      const base = slugifyTr(m.name);
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return { key: m.key, slug, title: m.name, count: m.count, spellings: m.spellings, fixed: false };
    });

  return [...head, ...tail];
}

/** Sabit olmayan (dinamik) kategoriyi slug ile bulur; yoksa null (sayfa 404). */
export const findDynamicCategory = (list: readonly CategoryEntry[], slug: string) => list.find((c) => !c.fixed && c.slug === slug) ?? null;

/** Kategori sayfası için ürün koşulu: tek yazım → eşitlik, birden çok yazım → IN (Postgres harf duyarsızlığına güvenilmez). */
export const categoryWhere = (spellings: readonly string[]) => (spellings.length === 1 ? { category: spellings[0] } : { category: { in: [...spellings] } });

/** Ürünün kategorisi bu kayda ait mi? (yönetim listesi çipleri) */
export const productInCategory = (productCategory: string, entry: Pick<CategoryEntry, "key">) => categoryKey(productCategory) === entry.key;

/** "yemek masası  üstü" → "Yemek Masası Üstü" (tr-TR başlık biçimi; kelime ilk harfi büyük, kalanı küçük). */
export function titleCaseTr(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1).toLocaleLowerCase("tr-TR") : w))
    .join(" ");
}

/**
 * Elle yazılan/seçilen kategori adını kaydedilecek yazıma çevirir: mevcut bir kategoriyle (tr-TR küçük harf + boşluk) eşleşiyorsa mevcut görünen yazım,
 * değilse başlık biçimi. Sabit kategorilerin veritabanı değerleri (Kristal, Modern, ...) mevcut listeden gelir ve aynen kalır.
 */
export function resolveCategoryName(input: string, list: readonly Pick<CategoryEntry, "key" | "fixed" | "spellings" | "title">[]): string {
  const key = categoryKey(input);
  if (!key) return "";
  const hit = list.find((c) => c.key === key);
  if (hit) return hit.fixed ? hit.spellings[0] : hit.title;
  return titleCaseTr(input);
}
