import { getCategoryList, getCategorySettings } from "@/lib/category-list";
import { categoryDisplayTitle, isCategoryHidden } from "@/lib/category-settings";
import { categoryKey, fallbackCoverWhere, visibleCategoryWhere, type CategoryEntry } from "@/lib/categories";
import { pickCollections, pickCover, resolveCollectionKeys } from "@/lib/collections";
import { getHomepageRaw } from "@/lib/homepage";
import { getActiveProducts, getProducts } from "@/lib/products";
import { CATEGORIES } from "@/lib/site";
import { coverImageOf } from "@/lib/variation-input";

export interface HomeCollection {
  slug: string;
  title: string;
  cover: string | null;
}

/** Hata olursa (veritabanı) sabit kategoriler: ana sayfa asla bozulmaz. */
const fixedFallback = (): CategoryEntry[] =>
  CATEGORIES.map((c) => ({ key: categoryKey(c.dbCategory), slug: c.slug, title: c.title, count: 1, spellings: [c.dbCategory], fixed: true }));

/** Ana sayfa koleksiyon kartları: yönetici seçimi (yoksa tüm kategoriler, listedeki sırayla); ürünsüz kategori yok; kapak = kategorinin ilk kapaklı aktif ürünü (yoksa görünen stoksuz ürün). */
export async function getHomeCollections(): Promise<HomeCollection[]> {
  const [list, raw, settings] = await Promise.all([getCategoryList().catch(fixedFallback), getHomepageRaw(), getCategorySettings()]);
  // Menüden gizlenen kategori ana sayfa satırından da çıkar; görünen ad ayarı varsa o kullanılır
  const visible = list.filter((c) => !isCategoryHidden(settings, c.key));
  const picked = pickCollections(visible, resolveCollectionKeys(raw));
  return Promise.all(
    picked.map(async (c) => {
      const products = await getActiveProducts(visibleCategoryWhere(c.spellings), 6).catch(() => []);
      // Aktif ürün yoksa: aynı kategori koşuluyla vitrinde görünen (stoksuz "göster" ayarlı) ürünlerden kapak
      const cover = await pickCover(products, () => getProducts(fallbackCoverWhere(c.spellings), 6).catch(() => []), coverImageOf);
      return { slug: c.slug, title: categoryDisplayTitle(settings, c.key, c.title), cover };
    })
  );
}
