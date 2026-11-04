import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { uploadedIdsOf } from "@/lib/variation-input";

export const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/** Ürüne hiç bağlanmamış, 24 saatten eski yüklemeleri siler (her yeni yüklemede çağrılır). */
export async function deleteStaleOrphans() {
  await prisma.productImage.deleteMany({ where: { productId: null, createdAt: { lt: new Date(Date.now() - ORPHAN_TTL_MS) } } });
}

/** Yüklenmiş görselleri ürüne bağlar. Kimliklerden biri yoksa ya da başka ürüne aitse false döner (bağlama yapılmaz). */
export async function attachUploads(tx: Prisma.TransactionClient, productId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const ok = await tx.productImage.count({ where: { id: { in: ids }, OR: [{ productId: null }, { productId }] } });
  if (ok !== ids.length) return false;
  await tx.productImage.updateMany({ where: { id: { in: ids }, productId: null }, data: { productId } });
  return true;
}

/** Ürünün ne ürün ne de renk görselinde geçmeyen yüklenmiş satırlarını siler (görsel kaldırıldığında yetim kalmasın). */
export async function pruneUploads(tx: Prisma.TransactionClient, productId: string) {
  const p = await tx.product.findUnique({ where: { id: productId }, select: { images: true, imageUrl: true, variations: { select: { images: true } } } });
  if (!p) return;
  const keep = uploadedIdsOf(p.images, p.imageUrl ? [p.imageUrl] : [], ...p.variations.map((v) => v.images));
  await tx.productImage.deleteMany({ where: { productId, id: { notIn: keep } } });
}
