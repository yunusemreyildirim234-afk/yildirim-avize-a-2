import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { CATEGORIES, COLLECTIONS, SITE_URL } from "@/lib/site";
import { getCategoryList, getFixedCategoryOverrides } from "@/lib/category-list";

export const dynamic = "force-dynamic";

const STATIC_PAGES = ["/musterilerimizden-gelenler", "/kargo-takip", "/iletisim", "/gizlilik-politikasi", "/kullanim-sartlari", "/mesafeli-satis-sozlesmesi", "/iptal-iade-cayma", "/aydinlatma-metni", "/cerez-politikasi"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product
    .findMany({ where: { active: true }, select: { id: true, updatedAt: true } })
    .catch(() => []);

  // Yönetim panelinden eklenen kategoriler (sabit olanlar CATEGORIES ile zaten var)
  const overrides = await getFixedCategoryOverrides();
  const extra = await getCategoryList().then((l) => l.filter((c) => !c.fixed)).catch(() => []);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...CATEGORIES.filter((c) => !overrides[c.slug]?.hidden).map((c) => ({
      url: `${SITE_URL}/kategori/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...extra.map((c) => ({
      url: `${SITE_URL}/kategori/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...Object.keys(COLLECTIONS).map((slug) => ({
      url: `${SITE_URL}/kategori/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/urun/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
