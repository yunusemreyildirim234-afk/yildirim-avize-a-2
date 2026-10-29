import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import type { Prisma } from "@prisma/client";

type FavoriteRow = Prisma.FavoriteGetPayload<{ include: { product: true } }>;

// Giriş yapmış müşterinin kalıcı favorileri
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const rows = await prisma.favorite.findMany({
    where: { userId, product: { active: true } },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
  const items = rows.map((r: FavoriteRow) => ({
    id: r.productId,
    title: r.product.title,
    category: r.product.category,
    basePrice: r.product.basePrice,
    imageUrl: r.product.imageUrl,
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

  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.favorite.createMany({ data: products.map((p: { id: string }) => ({ userId, productId: p.id })) }),
  ]);
  return NextResponse.json({ success: true });
}
