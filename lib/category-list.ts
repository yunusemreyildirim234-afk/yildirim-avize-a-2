import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { buildCategoryList } from "@/lib/categories";
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
