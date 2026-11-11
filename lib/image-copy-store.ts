// Görsel kopyalama için Prisma deposu (koşullu yazma). Saf çekirdek: lib/image-copy.ts.
import { prisma } from "@/lib/db";
import type { CopyProduct, CopyStore, PendingCount, WritePlan } from "@/lib/image-copy";

/** lib/image-copy.ts TRENDYOL_RE ile aynı kural (PostgreSQL ~* : harf duyarsız). */
const TRENDYOL_SQL_RE = String.raw`^https://([a-z0-9-]+\.)*dsmcdn\.com/`;

export const prismaCopyStore: CopyStore = {
  /** Yalnızca bu partinin ürünleri: atla listesi dışında en az bir Trendyol görseli olan ilk `limit` ürün. syncSnapshot OKUNMAZ (apply veritabanında birleştirir). */
  async list(opts = { atla: [], limit: 4 }): Promise<CopyProduct[]> {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Product" p
      WHERE EXISTS (
        SELECT 1 FROM (
          SELECT p."imageUrl" AS u
          UNION ALL SELECT unnest(p."images")
          UNION ALL SELECT unnest(v."images") FROM "ProductVariation" v WHERE v."productId" = p."id"
        ) s WHERE s.u ~* ${TRENDYOL_SQL_RE} AND NOT (s.u = ANY(${opts.atla}::text[]))
      )
      ORDER BY p."id" LIMIT ${opts.limit}`;
    if (ids.length === 0) return [];
    return prisma.product.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: { id: true, images: true, imageUrl: true, variations: { select: { id: true, images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } },
      orderBy: { id: "asc" },
    });
  },
  /** Bekleyen tekil görsel sayıları veritabanında sayılır (katalog Neon'dan çıkmaz). */
  async count(atla: string[]): Promise<PendingCount> {
    const rows = await prisma.$queryRaw<PendingCount[]>`
      SELECT count(DISTINCT s.u)::int AS "kalan", (count(DISTINCT s.u) FILTER (WHERE NOT (s.u = ANY(${atla}::text[]))))::int AS "sirada"
      FROM (
        SELECT "imageUrl" AS u FROM "Product"
        UNION ALL SELECT unnest("images") FROM "Product"
        UNION ALL SELECT unnest("images") FROM "ProductVariation"
      ) s WHERE s.u ~* ${TRENDYOL_SQL_RE}`;
    return { kalan: rows[0]?.kalan ?? 0, sirada: rows[0]?.sirada ?? 0 };
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
