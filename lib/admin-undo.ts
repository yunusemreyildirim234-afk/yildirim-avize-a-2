import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Yönetici "Geri Al" altyapısı: işlemden hemen önce etkilenen ürünlerin düzenlenebilir alanları (ve varyasyon stok/fiyatı) kaydedilir,
// geri alınırken aynen yazılır. Yalnızca adminGuard korumalı uçlardan üretilir/tüketilir.

export interface ProductSnap {
  id: string;
  title: string;
  category: string;
  basePrice: number;
  listPrice: number | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  bulkTiers: unknown;
  modelCode: string | null;
  images: string[];
  imageUrl: string | null;
  active: boolean;
  variations: { id: string; stock: number; extraPrice: number }[];
}

export interface UndoSnapshot {
  products: ProductSnap[];
  /** Geri alınırken silinecek (işlemle yeni eklenen) varyasyonlar */
  deleteVariationIds?: string[];
  /** Silinen ürünlerin tam kayıtları (JSON); geri alınırken yeniden oluşturulur */
  recreate?: { product: Record<string, unknown>; variations: Record<string, unknown>[] }[];
}

export async function snapshotProducts(ids: string[]): Promise<UndoSnapshot> {
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: { variations: { select: { id: true, stock: true, extraPrice: true } } } });
  return {
    products: rows.map((p) => ({
      id: p.id, title: p.title, category: p.category, basePrice: p.basePrice, listPrice: p.listPrice, isFeatured: p.isFeatured, isBestSeller: p.isBestSeller,
      bulkTiers: p.bulkTiers, modelCode: p.modelCode, images: p.images, imageUrl: p.imageUrl, active: p.active, variations: p.variations,
    })),
  };
}

/** Silinecek ürünün tam kopyası (geri alma için). */
export async function snapshotForDelete(productId: string): Promise<UndoSnapshot> {
  const p = await prisma.product.findUnique({ where: { id: productId }, include: { variations: true } });
  if (!p) return { products: [] };
  const { variations, ...product } = p;
  return { products: [], recreate: [{ product: JSON.parse(JSON.stringify(product)), variations: JSON.parse(JSON.stringify(variations)) }] };
}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const jsonOrNull = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
const withDates = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...row };
  for (const k of ["createdAt", "updatedAt"]) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  if ("bulkTiers" in out) out.bulkTiers = jsonOrNull(out.bulkTiers);
  return out;
};

export async function restoreSnapshot(snap: UndoSnapshot): Promise<number> {
  let restored = 0;
  for (const p of Array.isArray(snap.products) ? snap.products : []) {
    if (!isObj(p) || typeof p.id !== "string") continue;
    await prisma.product.updateMany({
      where: { id: p.id },
      data: {
        title: p.title, category: p.category, basePrice: p.basePrice, listPrice: p.listPrice, isFeatured: p.isFeatured, isBestSeller: p.isBestSeller,
        bulkTiers: jsonOrNull(p.bulkTiers), modelCode: p.modelCode, images: p.images, imageUrl: p.imageUrl, active: p.active,
      },
    });
    for (const v of Array.isArray(p.variations) ? p.variations : []) {
      await prisma.productVariation.updateMany({ where: { id: v.id }, data: { stock: v.stock, extraPrice: v.extraPrice } });
    }
    restored++;
  }
  if (Array.isArray(snap.deleteVariationIds) && snap.deleteVariationIds.length) {
    await prisma.productVariation.deleteMany({ where: { id: { in: snap.deleteVariationIds }, orderItems: { none: {} } } });
  }
  for (const r of Array.isArray(snap.recreate) ? snap.recreate : []) {
    if (!isObj(r.product) || typeof r.product.id !== "string") continue;
    const exists = await prisma.product.findUnique({ where: { id: r.product.id }, select: { id: true } });
    if (exists) continue;
    await prisma.product.create({ data: withDates(r.product) as unknown as Prisma.ProductCreateInput });
    if (r.variations.length) await prisma.productVariation.createMany({ data: r.variations.map((v) => withDates(v) as unknown as Prisma.ProductVariationCreateManyInput) });
    restored++;
  }
  return restored;
}
