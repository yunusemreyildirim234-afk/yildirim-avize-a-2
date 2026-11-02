import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import type { Prisma } from "@prisma/client";

type CartRow = Prisma.CartItemGetPayload<{ include: { variation: { include: { product: true } } } }>;

// Giriş yapmış müşterinin kalıcı sepeti (fiyat ve stok her seferinde veritabanından okunur)
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: { variation: { include: { product: true } } },
    orderBy: { updatedAt: "asc" },
  });

  const items = rows
    .filter((r: CartRow) => r.variation.product.active && r.variation.stock > 0)
    .map((r: CartRow) => ({
      productId: r.variation.productId,
      variationId: r.variationId,
      title: r.variation.product.title,
      imageUrl: r.variation.product.imageUrl,
      variationName: r.variation.variationValue,
      price: r.variation.product.basePrice + r.variation.extraPrice,
      quantity: Math.min(r.quantity, r.variation.stock),
    }));
  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw: { variationId?: unknown; quantity?: unknown }[] = Array.isArray(body.items) ? body.items.slice(0, 100) : [];

  const quantities = new Map<string, number>();
  for (const r of raw) {
    if (typeof r.variationId !== "string") continue;
    quantities.set(r.variationId, Math.min(99, Math.max(1, Math.floor(Number(r.quantity) || 1))));
  }

  const existing = await prisma.productVariation.findMany({
    where: { id: { in: [...quantities.keys()] }, product: { active: true } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { userId } }),
    prisma.cartItem.createMany({
      data: existing.map((v) => ({ userId, variationId: v.id, quantity: quantities.get(v.id) as number })),
    }),
  ]);
  return NextResponse.json({ success: true });
}
