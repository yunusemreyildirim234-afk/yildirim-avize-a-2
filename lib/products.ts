import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getProducts(where: Prisma.ProductWhereInput = {}, take?: number) {
  return prisma.product.findMany({
    where: { active: true, ...where },
    include: { variations: { orderBy: { id: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export type ProductWithVariations = Awaited<ReturnType<typeof getProducts>>[number];

export const DISCOUNTED: Prisma.ProductWhereInput = { listPrice: { not: null } };
// Avize/aydınlatma ürünleri (aksesuar hariç), en az bir varyasyonu stokta
export const FEATURED: Prisma.ProductWhereInput = {
  category: { not: "Aksesuar" },
  variations: { some: { stock: { gt: 0 } } },
};
