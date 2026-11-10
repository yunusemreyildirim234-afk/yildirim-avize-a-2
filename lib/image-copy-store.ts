// Görsel kopyalama için Prisma deposu (koşullu yazma). Saf çekirdek: lib/image-copy.ts.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { CopyProduct, CopyStore, WritePlan } from "@/lib/image-copy";

const asRec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const prismaCopyStore: CopyStore = {
  async list(): Promise<CopyProduct[]> {
    const rows = await prisma.product.findMany({
      select: { id: true, images: true, imageUrl: true, syncSnapshot: true, variations: { select: { id: true, images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } },
      orderBy: { id: "asc" },
    });
    return rows;
  },
  /** Ürün satırı hâlâ okunan görsel/kapak değerindeyse yazar (updateMany koşulu); değilse 0 satır → false. Renkler aynı işlemde koşullu yazılır. */
  async apply(plan: WritePlan): Promise<boolean> {
    const snapshot = { ...asRec(plan.oldSnapshot), imageMap: plan.imageMap } as Prisma.InputJsonValue;
    return prisma.$transaction(async (tx) => {
      const r = await tx.product.updateMany({
        where: { id: plan.id, images: { equals: plan.oldImages }, imageUrl: plan.oldImageUrl },
        data: { images: plan.newImages, imageUrl: plan.newImageUrl, syncSnapshot: snapshot },
      });
      if (r.count !== 1) return false;
      for (const v of plan.variations) await tx.productVariation.updateMany({ where: { id: v.id, productId: plan.id, images: { equals: v.old } }, data: { images: v.next } });
      return true;
    });
  },
};
