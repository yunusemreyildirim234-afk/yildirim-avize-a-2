import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// Sepet/favoriler gibi istemci listeleri için güncel görsel, fiyat ve stok bilgisi
export async function GET(req: Request) {
  const rl = rateLimit(req, "quick-products", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
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
      couponAllowed: true,
      pickupDiscountPct: true,
      transferDiscountPct: true,
      variations: { select: { id: true, variationValue: true, extraPrice: true, stock: true }, orderBy: { id: "asc" } },
    },
  });
  const ctx = await getLadderContext();
  return NextResponse.json({ products: products.map((p) => ({ ...p, ladder: priceLadder(p, ctx) })) });
}
