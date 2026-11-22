import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CATEGORIES, COLLECTIONS, SITE_URL } from "@/lib/site";
import { productPath } from "@/lib/product-url";
import { withVisibleProducts } from "@/lib/categories";
import { getCategoryList, getFixedCategoryOverrides } from "@/lib/category-list";
import { getGalleryPhotoCount } from "@/lib/customer-gallery";
import { getVisibleWhere } from "@/lib/visibility";

export const dynamic = "force-dynamic";

// Ürün listesi 1 saat önbelleklenir (her tarayıcı/bot isteğinde veritabanına gitmez); yönetimden yapılan değişiklikte "storefront" etiketiyle hemen yenilenir.
// Hata durumunda boş liste önbelleğe girmesin diye catch önbelleğin DIŞINDADIR. JSON'a çevrildiği için updatedAt metin olarak gelir.
const getSitemapProducts = unstable_cache(
  async () => (await prisma.product.findMany({ where: await getVisibleWhere(), select: { id: true, title: true, updatedAt: true } })).map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt.toISOString() })),
  ["sitemap-products"],
  { revalidate: 3600, tags: ["storefront"] },
);

const GALLERY_PAGE = "/musterilerimizden-gelenler";
const STATIC_PAGES = ["/kargo-takip", "/iletisim", "/gizlilik-politikasi", "/kullanim-sartlari", "/mesafeli-satis-sozlesmesi", "/iptal-iade-cayma", "/aydinlatma-metni", "/cerez-politikasi"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getSitemapProducts()
    .then((l) => l.map((p) => ({ id: p.id, title: p.title, updatedAt: new Date(p.updatedAt) })))
    .catch(() => []);

  const galleryCount = await getGalleryPhotoCount();

  // Yönetim panelinden eklenen kategoriler (sabit olanlar CATEGORIES ile zaten var)
  const overrides = await getFixedCategoryOverrides();
  const extra = await getCategoryList().then((l) => withVisibleProducts(l).filter((c) => !c.fixed)).catch(() => []);

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
      url: `${SITE_URL}${productPath(p)}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Müşteri fotoğrafı yokken boş sayfa sitemap'e girmez; fotoğraf olunca kendiliğinden geri gelir
    ...(galleryCount > 0 ? [GALLERY_PAGE, ...STATIC_PAGES] : STATIC_PAGES).map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
