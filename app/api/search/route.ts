import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

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

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}