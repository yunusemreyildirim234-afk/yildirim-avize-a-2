// Görsel kopyalama için Prisma deposu (koşullu yazma). Saf çekirdek: lib/image-copy.ts.
import { prisma } from "@/lib/db";
import type { CopyProduct, CopyStore, WritePlan } from "@/lib/image-copy";

export const prismaCopyStore: CopyStore = {
  async list(): Promise<CopyProduct[]> {
    const rows = await prisma.product.findMany({
      select: { id: true, images: true, imageUrl: true, syncSnapshot: true, variations: { select: { id: true, images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } },
      orderBy: { id: "asc" },
    });
    return rows;
  },
  /** Ürün satırı hâlâ okunan görsel/kapak değerindeyse yazar (updateMany koşulu); değilse 0 satır → false. Renkler aynı işlemde koşullu yazılır.
   *  syncSnapshot bayat kopyayla ezilmez: aynı işlemde (satır kilidi altında) yalnızca `imageMap` anahtarı güncel değerle birleştirilir (A3). */
  async apply(plan: WritePlan): Promise<boolean> {
    const imageMap = JSON.stringify(plan.imageMap);
    return prisma.$transaction(async (tx) => {
      const r = await tx.product.updateMany({
        where: { id: plan.id, images: { equals: plan.oldImages }, imageUrl: plan.oldImageUrl },
        data: { images: plan.newImages, imageUrl: plan.newImageUrl },
      });
      if (r.count !== 1) return false;
      await tx.$executeRaw`UPDATE "Product" SET "syncSnapshot" =
        (CASE WHEN jsonb_typeof("syncSnapshot") = 'object' THEN "syncSnapshot" ELSE '{}'::jsonb END)
        || jsonb_build_object('imageMap', (CASE WHEN jsonb_typeof("syncSnapshot"->'imageMap') = 'object' THEN "syncSnapshot"->'imageMap' ELSE '{}'::jsonb END) || ${imageMap}::jsonb)
        WHERE "id" = ${plan.id}`;
      for (const v of plan.variations) await tx.productVariation.updateMany({ where: { id: v.id, productId: plan.id, images: { equals: v.old } }, data: { images: v.next } });
      return true;
    });
  },
};
