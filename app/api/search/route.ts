import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { CARD_SELECT } from "@/lib/products";
import { clipQuery } from "@/lib/product-search";
import { searchProductIds } from "@/lib/listing";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { coverImageOf } from "@/lib/variation-input";

export async function GET(req: Request) {
  // Kimliksiz arama: IP başına dakikada 120 istek, sorgu en çok 80 karakter
  const rl = rateLimit(req, "search", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { searchParams } = new URL(req.url);
  const q = clipQuery(searchParams.get("q"));

  if (!q.trim()) {
    return NextResponse.json({ products: [] });
  }

  try {
    // Normalize eşleşme lib/listing.ts'de tek yerdedir (/arama ile aynı sonuçlar); tam model kodu en üstte
    const ids = await searchProductIds(q, 6);
    if (ids.length === 0) return NextResponse.json({ products: [] });
    // Yalnızca arama listesinin ve fiyat merdiveninin kullandığı alanlar (açıklama, görsel dizisi, Trendyol alanları çekilmez)
    const found = await prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
    const products = ids.flatMap((id) => found.filter((p) => p.id === id));

    const ctx = await getLadderContext();
    return NextResponse.json({ products: products.map((p) => ({ ...p, imageUrl: coverImageOf(p), ladder: priceLadder(p, ctx) })) });
  } catch (error) {
    return serverError("search", error, "Arama şu an yapılamadı. Lütfen tekrar deneyin.");
  }
}