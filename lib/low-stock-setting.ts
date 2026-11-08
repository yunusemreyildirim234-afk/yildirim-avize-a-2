import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_LOW_STOCK, resolveLowStock, type LowStockSetting } from "@/lib/low-stock";

/** "Son N adet" rozeti ayarı. 60 sn önbellek, "storefront" etiketi (yönetici kaydı geçersiz kılar). Hata olursa KAPALI (site eski haliyle çalışır). */
const cached = unstable_cache(
  async (): Promise<LowStockSetting> => {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } });
    return resolveLowStock(row?.homepageConfig);
  },
  ["sf-low-stock"],
  { revalidate: 60, tags: ["storefront"] }
);

export async function getLowStockSetting(): Promise<LowStockSetting> {
  try {
    return await cached();
  } catch {
    return DEFAULT_LOW_STOCK;
  }
}
