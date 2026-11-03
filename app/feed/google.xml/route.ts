import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { FEED_HEAD, FEED_TAIL, feedItemXml } from "@/lib/feed";

// Herkese açık, oturumsuz Google Merchant Center feed'i. Ürünler 50'şer (id sırasıyla) okunur ve parça parça akıtılır: bellek ürün sayısıyla büyümez.
// Her parça "storefront" etiketiyle 1 saat önbelleğe alınır (revalidateStorefront() yönetici işlemlerinde yeniler).
export const dynamic = "force-dynamic";

const BATCH = 50;

const getBatch = unstable_cache(
  async (cursor: string | null) => {
    const rows = await prisma.product.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, title: true, description: true, category: true, basePrice: true, listPrice: true, imageUrl: true, images: true, brand: true,
        variations: { select: { extraPrice: true, stock: true, barcode: true }, orderBy: { id: "asc" } },
      },
    });
    return {
      xml: rows.map((p) => feedItemXml(p, SITE_URL)).filter((x): x is string => x !== null).join("\n"),
      last: rows.length === BATCH ? rows[rows.length - 1].id : null,
    };
  },
  ["feed-google-batch"],
  { revalidate: 3600, tags: ["storefront"] }
);

export async function GET() {
  let first;
  try {
    first = await getBatch(null);
  } catch {
    return new Response("Feed geçici olarak kullanılamıyor.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const enc = new TextEncoder();
  let batch: { xml: string; last: string | null } | null = first;
  let started = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(enc.encode(FEED_HEAD(SITE_URL)));
      }
      if (batch) {
        if (batch.xml) controller.enqueue(enc.encode(batch.xml + "\n"));
        const next: string | null = batch.last;
        try {
          batch = next ? await getBatch(next) : null;
        } catch (e) {
          controller.error(e);
          return;
        }
        if (batch) return;
      }
      controller.enqueue(enc.encode(FEED_TAIL));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
