import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Sepet/favoriler gibi istemci listeleri için güncel görsel, fiyat ve stok bilgisi
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    select: {
      id: true,
      title: true,
      category: true,
      basePrice: true,
      imageUrl: true,
      variations: { select: { id: true, variationValue: true, extraPrice: true, stock: true }, orderBy: { id: "asc" } },
    },
  });
  return NextResponse.json({ products });
}
