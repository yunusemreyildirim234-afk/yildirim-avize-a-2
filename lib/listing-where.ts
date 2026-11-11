// Vitrin liste tabanı için SAF süzgeç (veritabanı ve Next yok; test edilebilir).
// Kategori / koleksiyon sayfalarının Prisma koşulu, paylaşılan tek katalog önbelleğinin satırları üzerinde bellekte uygulanır:
// her kategori için ayrı veritabanı okuması ve ayrı önbellek girdisi oluşmaz. Tanınmayan koşul → null (çağıran eski yola, veritabanına düşer).

export interface WhereRow {
  /** Veritabanındaki ham kategori yazımı (tam eşitlik; Postgres gibi harf duyarlı) */
  rc?: string;
  active?: boolean;
  featured: boolean;
  /** En az bir varyasyonu stokta */
  inStock?: boolean;
  /** listPrice ya da bulkMinQty dolu (lib/products.ts DISCOUNTED) */
  disc?: boolean;
}

type Test = (r: WhereRow) => boolean;
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const json = (v: unknown) => JSON.stringify(v);

const SOME_IN_STOCK = json({ some: { stock: { gt: 0 } } });
const DISCOUNTED_OR = json([{ listPrice: { not: null } }, { bulkMinQty: { not: null } }]);

function categoryTest(v: unknown): Test | null {
  if (typeof v === "string") return (r) => r.rc === v;
  if (!isRec(v)) return null;
  const keys = Object.keys(v);
  if (keys.length !== 1) return null;
  if (Array.isArray(v.in) && v.in.every((x) => typeof x === "string")) {
    const set = new Set(v.in as string[]);
    return (r) => r.rc !== undefined && set.has(r.rc);
  }
  if (typeof v.not === "string") {
    const not = v.not;
    return (r) => r.rc !== not;
  }
  return null;
}

/**
 * Desteklenen koşullar (kategori sayfasının ürettiği şekiller): {} · active · isFeatured · category (eşit / in / not) ·
 * variations.some.stock>0 · OR[listPrice dolu, bulkMinQty dolu]. Anahtarlar VE ile birleşir. Başka her şekil → null.
 */
export function rowFilter(where: unknown): Test | null {
  if (!isRec(where)) return null;
  const tests: Test[] = [];
  for (const [k, v] of Object.entries(where)) {
    if (k === "active" && typeof v === "boolean") tests.push((r) => r.active === v);
    else if (k === "isFeatured" && typeof v === "boolean") tests.push((r) => r.featured === v);
    else if (k === "category") {
      const t = categoryTest(v);
      if (!t) return null;
      tests.push(t);
    } else if (k === "variations" && json(v) === SOME_IN_STOCK) tests.push((r) => r.inStock === true);
    else if (k === "OR" && json(v) === DISCOUNTED_OR) tests.push((r) => r.disc === true);
    else return null;
  }
  return (r) => tests.every((t) => t(r));
}
