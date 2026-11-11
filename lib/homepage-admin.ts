// Yönetim paneli "Ana Sayfayı Düzenle" için bölüm havuzlarının DAR sürümü: yalnızca kimlik, başlık, model kodu.
// Vitrin işlevleri (lib/homepage.ts getSectionPools, lib/products.ts getBestSellers) kartın tüm alanlarını, varyasyonlarını ve görsellerini okur;
// panel bunların hiçbirini kullanmaz. Üyelik ve sıra vitrinle AYNI kurallardır (tests/admin-havuz-dar.test.mjs iki sürümü karşılaştırır).
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DISCOUNTED, FEATURED, getHiddenBestSellerIds, getRankedSellerIds } from "@/lib/products";
import { SHOWCASE_ORDER_BY } from "@/lib/showcase-order";

const SLIM = { id: true, title: true, modelCode: true } satisfies Prisma.ProductSelect;
const POOL = 100;

const getShowcaseSlim = (where: Prisma.ProductWhereInput = {}, take?: number) => prisma.product.findMany({ where: { active: true, ...where }, select: SLIM, orderBy: SHOWCASE_ORDER_BY, take });
const getActiveSlim = (where: Prisma.ProductWhereInput = {}, take?: number) => prisma.product.findMany({ where: { active: true, ...where }, select: SLIM, orderBy: { updatedAt: "desc" }, take });

/** lib/products.ts getBestSellers ile aynı adımlar (işaretliler → en çok sipariş edilenler → doldurma; gizlenenler her aşamada dışarıda). */
export async function getBestSellersSlim(take: number) {
  const hidden = await getHiddenBestSellerIds();
  const picked = await getShowcaseSlim({ isBestSeller: true, ...(hidden.length ? { id: { notIn: hidden } } : {}) }, take);
  if (picked.length >= take) return picked;
  const seen = new Set(picked.map((p) => p.id));
  const hiddenSet = new Set(hidden);

  const rankedIds = (await getRankedSellerIds()).filter((id) => !seen.has(id) && !hiddenSet.has(id));

  const ranked = rankedIds.length ? await getActiveSlim({ id: { in: rankedIds }, ...FEATURED }) : [];
  ranked.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
  const out = [...picked, ...ranked].slice(0, take);
  if (out.length >= take) return out;

  const have = new Set(out.map((p) => p.id));
  const filler = await getShowcaseSlim({ ...FEATURED, id: { notIn: [...have, ...hidden] } }, take - out.length);
  return [...out, ...filler];
}

/** lib/homepage.ts getSectionPools ile aynı kümeler ve sıra; yalnızca dar alanlar. */
export async function getAdminSectionPools() {
  const flagged = await getShowcaseSlim({ isFeatured: true }, POOL);
  const [featuredAuto, discounted, bestsellers] = await Promise.all([
    flagged.length > 0 ? Promise.resolve(flagged) : getShowcaseSlim(FEATURED, POOL),
    getActiveSlim(DISCOUNTED, POOL),
    getBestSellersSlim(POOL),
  ]);
  return { featured: featuredAuto, featuredManual: flagged.length > 0, discounted, bestsellers };
}
