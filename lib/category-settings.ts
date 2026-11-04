// Kategori yönetimi için saf yardımcılar (veritabanı yok, test edilebilir).
// Ayarlar SiteConfig.homepageConfig JSON'unda saklanır:
//   categorySettings: { [kategoriAnahtarı]: { title?, hidden? } }  — yalnızca SABİT kategoriler için görünen ad / menüden gizleme
//   categoryRedirects: { [eskiSlug]: yeniSlug }                    — yeniden adlandırılan kategorilerin eski adresi (düz eşleme, zincir yok)
//   collections: [kategoriAnahtarı...]                             — ana sayfa koleksiyon seçimi (lib/collections.ts)
import { categoryKey, titleCaseTr, type CategoryEntry, type FixedCategory } from "./categories.ts";

export const MAX_CATEGORY_NAME = 60;
const MAX_KEY = 80;
const CONTROL = /[\u0000-\u001f\u007f]/;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export interface CategorySetting {
  title?: string;
  hidden?: boolean;
}
export type CategorySettings = Record<string, CategorySetting>;
export type CategoryRedirects = Record<string, string>;

const asObj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Görünen ad doğrulaması: boşluklar sadeleşir, boş olamaz, en fazla 60 karakter, denetim karakteri yok. Başlık biçimine çevrilmez (ör. "Klasik Koleksiyon"). */
export function validateDisplayTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Ad metin olmalıdır." };
  const title = raw.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Ad boş olamaz." };
  if (CONTROL.test(title)) return { ok: false, error: "Ad geçersiz karakter içeriyor." };
  if (title.length > MAX_CATEGORY_NAME) return { ok: false, error: `Ad en fazla ${MAX_CATEGORY_NAME} karakter olabilir.` };
  return { ok: true, title };
}

/** homepageConfig.categorySettings'i güvenle çözer; bozuk girdiler atılır, boş kayıtlar tutulmaz. */
export function resolveCategorySettings(homepageConfig: unknown): CategorySettings {
  const src = asObj(asObj(homepageConfig)?.categorySettings);
  const out: CategorySettings = {};
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    const o = asObj(v);
    if (!o || !k || k.length > MAX_KEY) continue;
    const t = o.title === undefined ? null : validateDisplayTitle(o.title);
    const entry: CategorySetting = { ...(t?.ok ? { title: t.title } : {}), ...(o.hidden === true ? { hidden: true } : {}) };
    if (entry.title !== undefined || entry.hidden) out[k] = entry;
  }
  return out;
}

/** Görünen ad: ayar varsa o, yoksa çağıran yerin mevcut etiketi (menü / ana sayfa / alt bilgi farklı olabilir; ayar yokken aynen korunur). */
export const categoryDisplayTitle = (settings: CategorySettings, key: string, fallback: string): string => settings[key]?.title || fallback;

export const isCategoryHidden = (settings: CategorySettings, key: string): boolean => settings[key]?.hidden === true;

/** Tek kategorinin ayarını günceller (null = o alanı sil). Boşalan kayıt tamamen kaldırılır. Girdiyi değiştirmez. */
export function patchCategorySetting(settings: CategorySettings, key: string, patch: { title?: string | null; hidden?: boolean | null }): CategorySettings {
  const cur: CategorySetting = { ...(settings[key] ?? {}) };
  if (patch.title !== undefined) {
    if (patch.title === null) delete cur.title;
    else cur.title = patch.title;
  }
  if (patch.hidden !== undefined) {
    if (patch.hidden) cur.hidden = true;
    else delete cur.hidden;
  }
  const next = { ...settings };
  if (cur.title === undefined && !cur.hidden) delete next[key];
  else next[key] = cur;
  return next;
}

// ---------- Eski adres yönlendirmeleri ----------

/** homepageConfig.categoryRedirects'i çözer: geçersiz slug, kendine yönlenen girdiler atılır. */
export function resolveCategoryRedirects(homepageConfig: unknown): CategoryRedirects {
  const src = asObj(asObj(homepageConfig)?.categoryRedirects);
  const out: CategoryRedirects = {};
  if (!src) return out;
  for (const [from, to] of Object.entries(src)) if (typeof to === "string" && SLUG_RE.test(from) && SLUG_RE.test(to) && from !== to) out[from] = to;
  return out;
}

/**
 * Eski → yeni eşleme ekler. Zincir oluşmaz (A→B + B→C ise A→C); canlı bir kategorinin slug'ı hiçbir zaman yönlendirme anahtarı olamaz
 * (canlı slug önceliklidir); kendine yönlenen girdi silinir. `liveSlugs` değişiklik SONRASI canlı slug'lar (sabit + rezerve dahil).
 */
export function addRedirect(redirects: CategoryRedirects, oldSlug: string, newSlug: string, liveSlugs: ReadonlySet<string>): CategoryRedirects {
  const next: CategoryRedirects = { ...redirects };
  if (oldSlug !== newSlug) {
    for (const k of Object.keys(next)) if (next[k] === oldSlug) next[k] = newSlug;
    next[oldSlug] = newSlug;
  }
  for (const k of Object.keys(next)) if (liveSlugs.has(k) || next[k] === k) delete next[k];
  return next;
}

/** Silinen kategori: ona yönlenenler ve kendi eski adresi kalkar (404 verir). */
export function removeRedirectsTo(redirects: CategoryRedirects, slug: string): CategoryRedirects {
  return Object.fromEntries(Object.entries(redirects).filter(([from, to]) => to !== slug && from !== slug));
}

/** İstenen slug canlı değilse ve eşlemesi canlı bir slug'a gidiyorsa hedef; aksi halde null (404). */
export function resolveRedirect(redirects: CategoryRedirects, slug: string, liveSlugs: ReadonlySet<string>): string | null {
  if (liveSlugs.has(slug)) return null;
  const to = redirects[slug];
  return to && liveSlugs.has(to) ? to : null;
}

// ---------- Ana sayfa koleksiyon anahtarları ----------

export function renameCollectionKey(keys: readonly string[], from: string, to: string): string[] {
  return [...new Set(keys.map((k) => (k === from ? to : k)))];
}
export const removeCollectionKey = (keys: readonly string[], key: string): string[] => keys.filter((k) => k !== key);

// ---------- Yeniden adlandırma / silme planı ----------

export type RenamePlan =
  | { ok: false; error: string }
  | { ok: true; kind: "merge-needed"; target: { key: string; title: string; count: number } }
  | { ok: true; kind: "rename" | "merge"; fromKey: string; toKey: string; newName: string };

/**
 * Sabit olmayan bir kategorinin adını değiştirme planı. Ad: başlık biçimi + boşluk sadeleştirme, 1-60 karakter,
 * sabit kategori adlarıyla (veritabanı adı ve görünen başlık) çakışamaz. Başka bir mevcut kategoriyle aynıysa onayla birleşir
 * (birleşmede ürünler hedefin görünen adını alır).
 */
export function planRename(list: readonly CategoryEntry[], fixed: readonly FixedCategory[], key: string, input: string, confirmMerge: boolean): RenamePlan {
  const entry = list.find((c) => c.key === key);
  if (!entry) return { ok: false, error: "Kategori bulunamadı." };
  if (entry.fixed) return { ok: false, error: "Sabit kategorinin veritabanı adı değiştirilemez; yalnızca görünen ad değiştirilebilir." };
  const name = titleCaseTr(typeof input === "string" ? input : "");
  if (!name) return { ok: false, error: "Ad boş olamaz." };
  if (CONTROL.test(name)) return { ok: false, error: "Ad geçersiz karakter içeriyor." };
  if (name.length > MAX_CATEGORY_NAME) return { ok: false, error: `Ad en fazla ${MAX_CATEGORY_NAME} karakter olabilir.` };
  const toKey = categoryKey(name);
  const reserved = new Set(fixed.flatMap((f) => [categoryKey(f.dbCategory), categoryKey(f.title)]));
  if (reserved.has(toKey)) return { ok: false, error: "Bu ad sabit bir kategoriyle çakışıyor; farklı bir ad seçin." };
  const target = toKey !== key ? list.find((c) => c.key === toKey) : undefined;
  if (target) {
    if (!confirmMerge) return { ok: true, kind: "merge-needed", target: { key: target.key, title: target.title, count: target.count } };
    return { ok: true, kind: "merge", fromKey: key, toKey, newName: target.title };
  }
  return { ok: true, kind: "rename", fromKey: key, toKey, newName: name };
}

export type DeletePlan = { ok: false; error: string } | { ok: true; key: string; count: number };

/** Silme planı: sabit kategori silinemez. Ürünlerin kategorisi "" olur (ürünler silinmez). */
export function planDelete(list: readonly CategoryEntry[], key: string): DeletePlan {
  const entry = list.find((c) => c.key === key);
  if (!entry) return { ok: false, error: "Kategori bulunamadı." };
  if (entry.fixed) return { ok: false, error: "Sabit kategoriler silinemez; menüden gizleyebilirsiniz." };
  return { ok: true, key, count: entry.count };
}

/** Kategorisiz (boş / yalnız boşluk) ürün sayısı. */
export const uncategorizedCount = (products: readonly { category: string }[]): number => products.filter((p) => !p.category || !p.category.trim()).length;
