import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sameIdSet } from "@/lib/list-sync";
import { getSessionUserId } from "@/lib/account";
import type { Prisma } from "@/generated/prisma/client";
import { coverImageOf } from "@/lib/variation-input";
import { getVisibleWhere } from "@/lib/visibility";

// Yanıtta kullanılan alanlar dışında ürün verisi okunmaz
const FAVORITE_SELECT = {
  productId: true,
  product: {
    select: {
      title: true, category: true, basePrice: true, imageUrl: true, images: true,
      variations: { select: { images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  },
} satisfies Prisma.FavoriteSelect;
type FavoriteRow = Prisma.FavoriteGetPayload<{ select: typeof FAVORITE_SELECT }>;

// Giriş yapmış müşterinin kalıcı favorileri
export async function GET() {
  const userId = await getSessionUserId();
  // Oturum yok: 401 yerine 200 (tarayıcı konsoluna hata düşmesin); istemci `anon` ile ayırt eder
  if (!userId) return NextResponse.json({ items: [], anon: true });

  const rows = await prisma.favorite.findMany({
    where: { userId, product: await getVisibleWhere() },
    select: FAVORITE_SELECT,
    orderBy: { createdAt: "asc" },
  });
  const items = rows.map((r: FavoriteRow) => ({
    id: r.productId,
    title: r.product.title,
    category: r.product.category,
    basePrice: r.product.basePrice,
    imageUrl: coverImageOf(r.product), // kapak kuralı: genel fotoğrafların ilki, yoksa ilk rengin fotoğrafı
  }));
  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawItems: { id?: unknown }[] = Array.isArray(body.items) ? body.items : [];
  const ids = [...new Set(rawItems.map((i) => i?.id).filter((id): id is string => typeof id === "string"))].slice(0, 300);

  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });

  // Gelen liste kayıtlıyla aynıysa yazma yapılmaz
  const stored = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
  if (!sameIdSet(stored.map((f: { productId: string }) => f.productId), products.map((p: { id: string }) => p.id))) {
    await prisma.$transaction([
      prisma.favorite.deleteMany({ where: { userId } }),
      prisma.favorite.createMany({ data: products.map((p: { id: string }) => ({ userId, productId: p.id })) }),
    ]);
  }
  return NextResponse.json({ success: true });
}
