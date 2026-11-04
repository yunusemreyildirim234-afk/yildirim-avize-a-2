import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { buildCategoryList, categoryKey, resolveCategoryName } from "@/lib/categories";
import { resolveCategoryRedirects, resolveCategorySettings, type CategoryRedirects, type CategorySettings } from "@/lib/category-settings";
import { CATEGORIES } from "@/lib/site";

/**
 * Vitrin kategori listesi tek kaynağı: menü, mobil şerit, alt bilgi, sitemap ve /kategori/[slug] buradan beslenir.
 * Etkin ürünlerdeki farklı kategoriler (büyük/küçük harf birleştirilmiş) + sabit kategoriler. 60 sn önbellek, "storefront" etiketi
 * (revalidateStorefront() yönetici işlemlerinde geçersiz kılar). Kişiye bağlı veri yoktur.
 */
export const getCategoryList = unstable_cache(
  async () => {
    const rows = await prisma.product.groupBy({ by: ["category"], where: { active: true }, _count: { _all: true } });
    return buildCategoryList(
      rows.map((r) => ({ category: r.category, count: r._count._all })),
      CATEGORIES
    );
  },
  ["sf-category-list"],
  { revalidate: 60, tags: ["storefront"] }
);

/**
 * Yönetim panelinden verilen kategori ayarları (sabit kategorilerin görünen adı / menüden gizleme) ve yeniden adlandırma yönlendirmeleri.
 * SiteConfig.homepageConfig içinde saklanır; 60 sn önbellek, "storefront" etiketi. Hata/boş → varsayılan (ayar yok).
 */
export const getCategoryConfig = unstable_cache(
  async (): Promise<{ settings: CategorySettings; redirects: CategoryRedirects }> => {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    return { settings: resolveCategorySettings(row?.homepageConfig), redirects: resolveCategoryRedirects(row?.homepageConfig) };
  },
  ["sf-category-config"],
  { revalidate: 60, tags: ["storefront"] }
);

export async function getCategorySettings(): Promise<CategorySettings> {
  try {
    return (await getCategoryConfig()).settings;
  } catch {
    return {};
  }
}

export type FixedOverrides = Record<string, { title?: string; hidden?: boolean }>;

/** Sabit kategorilerin slug'a göre görünen ad / gizleme ayarı (menü, mobil şerit, alt bilgi). Ayar yoksa boş nesne. */
export async function getFixedCategoryOverrides(): Promise<FixedOverrides> {
  const settings = await getCategorySettings();
  const out: FixedOverrides = {};
  for (const c of CATEGORIES) {
    const s = settings[categoryKey(c.dbCategory)];
    if (s) out[c.slug] = { ...(s.title ? { title: s.title } : {}), ...(s.hidden ? { hidden: true } : {}) };
  }
  return out;
}

/** Menü/alt bilgi için yalnızca sonradan eklenen (sabit olmayan) kategoriler; veritabanı hatasında boş (menü sabit listeyle çalışır). */
export async function getExtraCategoryLinks(): Promise<{ href: string; label: string }[]> {
  try {
    return (await getCategoryList()).filter((c) => !c.fixed).map((c) => ({ href: `/kategori/${c.slug}`, label: c.title }));
  } catch {
    return [];
  }
}

/**
 * Yönetim panelinden gelen kategori adını kaydedilecek yazıma çevirir (taze okuma, önbelleksiz; pasif ürünler dahil):
 * mevcut bir kategoriyle büyük/küçük harf-boşluk farkıyla çakışırsa mevcut yazım, yeniyse başlık biçimi. Boşsa "".
 */
export async function resolveCategoryForSave(input: string): Promise<string> {
  const rows = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } });
  const list = buildCategoryList(
    rows.map((r) => ({ category: r.category, count: r._count._all })),
    CATEGORIES
  );
  return resolveCategoryName(input, list);
}

/** Yönetim formları için sonradan eklenen (sabit olmayan) kategori adları; hata olursa boş. */
export async function getExtraCategoryNames(): Promise<string[]> {
  try {
    return (await getCategoryList()).filter((c) => !c.fixed).map((c) => c.title);
  } catch {
    return [];
  }
}
