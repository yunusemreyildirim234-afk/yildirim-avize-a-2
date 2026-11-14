// Yönetim paneli ürün listesi kapakları: görsel dizilerini çekmeden kapağı veritabanında hesaplar.
// Kural coverImageOf (lib/variation-input.ts) ile BİREBİR aynı sıradadır (saf ayna: coverByRule, tests/admin-liste-dar-select.test.mjs):
//   1) images dizisinin ilk DOLU elemanı  2) imageUrl  3) position, id sırasındaki ilk fotoğraflı rengin ilk dolu fotoğrafı.
import { prisma } from "@/lib/db";

/** Ürün kimliği → kapak. Hata olursa liste kapaksız açılır (panel çökmez); hata günlüğe yazılır. */
export async function loadAdminCovers(): Promise<Map<string, string>> {
  try {
    const rows = await prisma.$queryRaw<{ id: string; cover: string | null }[]>`
      SELECT p."id" AS "id", COALESCE(
        (SELECT t.u FROM unnest(p."images") WITH ORDINALITY AS t(u, n) WHERE t.u <> '' ORDER BY t.n LIMIT 1),
        NULLIF(p."imageUrl", ''),
        (SELECT t.u FROM "ProductVariation" v, unnest(v."images") WITH ORDINALITY AS t(u, n) WHERE v."productId" = p."id" AND t.u <> '' ORDER BY v."position", v."id", t.n LIMIT 1)
      ) AS "cover"
      FROM "Product" p`;
    return new Map(rows.flatMap((r) => (r.cover ? [[r.id, r.cover] as const] : [])));
  } catch (error) {
    console.error("[admin/covers] kapak sorgusu başarısız, liste kapaksız açılıyor:", (error as Error)?.message ?? error);
    return new Map();
  }
}
