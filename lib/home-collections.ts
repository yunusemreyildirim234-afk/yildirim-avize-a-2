import { getCategoryList } from "@/lib/category-list";
import { categoryWhere, type CategoryEntry } from "@/lib/categories";
import { pickCollections, resolveCollectionKeys } from "@/lib/collections";
import { getHomepageRaw } from "@/lib/homepage";
import { getProducts } from "@/lib/products";
import { CATEGORIES } from "@/lib/site";
import { coverImageOf } from "@/lib/variation-input";

export interface HomeCollection {
  slug: string;
  title: string;
  cover: string | null;
}

/** Hata olursa (veritabanı) sabit kategoriler: ana sayfa asla bozulmaz. */
const fixedFallback = (): CategoryEntry[] =>
  CATEGORIES.map((c) => ({ key: c.dbCategory.toLocaleLowerCase("tr-TR"), slug: c.slug, title: c.title, count: 1, spellings: [c.dbCategory], fixed: true }));

/** Ana sayfa koleksiyon kartları: yönetici seçimi (yoksa tüm kategoriler, listedeki sırayla); ürünsüz kategori yok; kapak = kategorinin ilk kapaklı ürünü. */
export async function getHomeCollections(): Promise<HomeCollection[]> {
  const [list, raw] = await Promise.all([getCategoryList().catch(fixedFallback), getHomepageRaw()]);
  const picked = pickCollections(list, resolveCollectionKeys(raw));
  return Promise.all(
    picked.map(async (c) => {
      const products = await getProducts({ ...categoryWhere(c.spellings), active: true }, 6).catch(() => []);
      const cover = products.map((p) => coverImageOf(p)).find((u): u is string => Boolean(u)) ?? null;
      return { slug: c.slug, title: c.title, cover };
    })
  );
}
