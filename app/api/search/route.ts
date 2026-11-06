import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { CARD_SELECT } from "@/lib/products";
import { clipQuery, searchWhere } from "@/lib/product-search";
import { getLadderContext } from "@/lib/showcase";
import { priceLadder } from "@/lib/price-ladder";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { coverImageOf } from "@/lib/variation-input";

export async function GET(req: Request) {
  // Kimliksiz ve indeksiz (contains) arama: IP başına dakikada 120 istek, sorgu en çok 80 karakter
  const rl = rateLimit(req, "search", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { searchParams } = new URL(req.url);
  const q = clipQuery(searchParams.get("q"));

  if (!q.trim()) {
    return NextResponse.json({ products: [] });
  }

  try {
    const code = q.trim();
    // Yalnızca arama listesinin ve fiyat merdiveninin kullandığı alanlar (açıklama, görsel dizisi, Trendyol alanları çekilmez)
    // Koşul lib/product-search.ts'de tek yerde tanımlıdır (/arama sayfasıyla aynı sonuçlar)
    const [byCode, byText] = await Promise.all([
      prisma.product.findFirst({ where: { active: true, modelCode: code }, select: CARD_SELECT }),
      prisma.product.findMany({ where: searchWhere(q), select: CARD_SELECT, take: 6 }),
    ]);

    // Tam model kodu eşleşmesi her zaman en üstte
    const products = [...(byCode ? [byCode] : []), ...byText.filter((p) => p.id !== byCode?.id)].slice(0, 6);

    const ctx = await getLadderContext();
    return NextResponse.json({ products: products.map((p) => ({ ...p, imageUrl: coverImageOf(p), ladder: priceLadder(p, ctx) })) });
  } catch (error) {
    return serverError("search", error, "Arama şu an yapılamadı. Lütfen tekrar deneyin.");
  }
}