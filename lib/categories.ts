// Kategori listesi için saf yardımcılar (veritabanından bağımsız; test edilebilir).
// Sabit kategoriler (lib/site.ts CATEGORIES) adı/slug'ı/sırasıyla aynen korunur; yönetim panelinden eklenenler arkasına gelir.

export interface FixedCategory {
  slug: string;
  title: string;
  dbCategory: string;
}

export interface CategoryEntry {
  slug: string;
  title: string;
  /** Aktif ürün sayısı (sabit kategoride aynı yazımın büyük/küçük harf varyantları da sayılır). */
  count: number;
  /** Veritabanındaki gerçek yazımlar (kategori IN sorgusu için; harf duyarsız karşılaştırmaya güvenilmez). */
  spellings: string[];
  fixed: boolean;
}

/** Kategori sayfası olarak ayrılmış slug'lar (dinamik kategoriler bunlarla çakışmaz). */
export const RESERVED_SLUGS = ["tum", "one-cikanlar", "indirimli", "cok-satanlar"];

/** Birleştirme anahtarı: boşlukları sadeleştirir, tr-TR küçük harf ("YEMEK MASASI" = "Yemek Masası"; İ→i, I→ı). */
export const categoryKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

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

  const head: CategoryEntry[] = fixed.map((f) => ({
    slug: f.slug,
    title: f.title,
    count: byKey.get(categoryKey(f.dbCategory))?.count ?? 0,
    spellings: [f.dbCategory], // sabit sayfa davranışı değişmez: tam eşleşme
    fixed: true,
  }));

  const used = new Set<string>([...fixed.map((f) => f.slug), ...RESERVED_SLUGS]);
  const tail = merged
    .filter((m) => !fixedKeys.has(m.key))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"))
    .map((m): CategoryEntry => {
      const base = slugifyTr(m.name);
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return { slug, title: m.name, count: m.count, spellings: m.spellings, fixed: false };
    });

  return [...head, ...tail];
}

/** Sabit olmayan (dinamik) kategoriyi slug ile bulur; yoksa null (sayfa 404). */
export const findDynamicCategory = (list: readonly CategoryEntry[], slug: string) => list.find((c) => !c.fixed && c.slug === slug) ?? null;
