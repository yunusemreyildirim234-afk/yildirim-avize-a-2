import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { CATEGORIES, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATIC_PAGES = ["/iletisim", "/gizlilik-politikasi", "/kullanim-sartlari", "/mesafeli-satis-sozlesmesi"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product
    .findMany({ select: { id: true, updatedAt: true } })
    .catch(() => []);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/kategori/${c.slug}`,
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
