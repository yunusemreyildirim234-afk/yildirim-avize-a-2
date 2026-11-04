import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { buildCategoryList, resolveCategoryName } from "@/lib/categories";
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
