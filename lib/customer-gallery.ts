import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { REVIEW_STATUS } from "@/lib/reviews";

/**
 * "Müşterilerimizden Gelenler" sayfasında gösterilecek (onaylı, fotoğraflı) yorum sayısı. Salt okunur, 60 sn önbellek.
 * Okunamazsa 0 döner (sayfa, bağlantı ve sitemap kaydı gizli kalır; fotoğraf olunca kendiliğinden geri gelir).
 */
export const getGalleryPhotoCount = unstable_cache(
  async (): Promise<number> => prisma.review.count({ where: { status: REVIEW_STATUS.APPROVED, imageUrl: { not: null } } }).catch(() => 0),
  ["gallery-photo-count"],
  { revalidate: 60, tags: ["storefront"] }
);
