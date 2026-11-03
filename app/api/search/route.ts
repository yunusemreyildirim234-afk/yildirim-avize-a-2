import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export async function GET(req: Request) {
  // Kimliksiz ve indeksiz (contains) arama: IP başına dakikada 120 istek, sorgu en çok 80 karakter
  const rl = rateLimit(req, "search", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").slice(0, 80);

  if (!q.trim()) {
    return NextResponse.json({ products: [] });
  }

  try {
    const code = q.trim();
    const include = {
      variations: { select: { id: true, variationValue: true, extraPrice: true, stock: true }, orderBy: { id: "asc" as const } },
    };

    // Başlıkta, açıklamada, kategoride, stok kodunda, barkodda veya model kodunda ara (büyük/küçük harf duyarsız)
    const [byCode, byText] = await Promise.all([
      prisma.product.findFirst({ where: { active: true, modelCode: code }, include }),
      prisma.product.findMany({
        where: {
          active: true,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { variations: { some: { barcode: { contains: code } } } },
            { variations: { some: { stockCode: { contains: code, mode: "insensitive" } } } },
          ],
        },
        include,
        take: 6,
      }),
    ]);

    // Tam model kodu eşleşmesi her zaman en üstte
    const products = [...(byCode ? [byCode] : []), ...byText.filter((p) => p.id !== byCode?.id)].slice(0, 6);

    const ctx = await getLadderContext();
    return NextResponse.json({ products: products.map((p) => ({ ...p, ladder: priceLadder(p, ctx) })) });
  } catch (error) {
    return serverError("search", error, "Arama şu an yapılamadı. Lütfen tekrar deneyin.");
  }
}