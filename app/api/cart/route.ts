import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sameCartRows } from "@/lib/list-sync";
import { getSessionUserId } from "@/lib/account";
import type { Prisma } from "@/generated/prisma/client";
import { bulkTiersOf } from "@/lib/bulk-pricing";
import { coverImageOf } from "@/lib/variation-input";
import { isPurchasablePrice, priceUnavailableMessage } from "@/lib/purchasable";

type CartRow = Prisma.CartItemGetPayload<{ include: { variation: { include: { product: { include: { variations: { select: { images: true } } } } } } } }>;

// Giriş yapmış müşterinin kalıcı sepeti (fiyat ve stok her seferinde veritabanından okunur)
export async function GET() {
  const userId = await getSessionUserId();
  // Oturum yok: 401 yerine 200 (tarayıcı konsoluna hata düşmesin); istemci `anon` ile ayırt eder
  if (!userId) return NextResponse.json({ items: [], anon: true });

  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: { variation: { include: { product: { include: { variations: { select: { images: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } } } } } },
    orderBy: { updatedAt: "asc" },
  });

  const items = rows
    .filter((r: CartRow) => r.variation.product.active && r.variation.stock > 0 && isPurchasablePrice(r.variation.product.basePrice + r.variation.extraPrice)) // fiyatı 0/altı kalem hesap sepetine alınmaz
    .map((r: CartRow) => ({
      productId: r.variation.productId,
      variationId: r.variationId,
      title: r.variation.product.title,
      imageUrl: coverImageOf(r.variation.product),
      variationName: r.variation.variationValue,
      price: r.variation.product.basePrice + r.variation.extraPrice,
      listPrice: r.variation.product.listPrice && r.variation.product.listPrice > r.variation.product.basePrice ? r.variation.product.listPrice + r.variation.extraPrice : null,
      bulk: bulkTiersOf(r.variation.product),
      rules: { couponAllowed: r.variation.product.couponAllowed, pickupPct: r.variation.product.pickupDiscountPct, transferPct: r.variation.product.transferDiscountPct },
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

  const found = await prisma.productVariation.findMany({
    where: { id: { in: [...quantities.keys()] }, product: { active: true } },
    select: { id: true, extraPrice: true, product: { select: { title: true, basePrice: true } } },
  });
  // Fiyatı 0 veya altı kalemler kaydedilmez (sipariş yollarındaki kuralla aynı); istemciye nedeni bildirilir
  const existing = found.filter((v) => isPurchasablePrice(v.product.basePrice + v.extraPrice));
  const rejected = found.filter((v) => !existing.includes(v)).map((v) => ({ variationId: v.id, error: priceUnavailableMessage(v.product.title) }));

  // Gelen liste kayıtlıyla aynıysa yazma yapılmaz (her sayfa açılışında sil-yeniden-yaz yok)
  const next = existing.map((v) => ({ variationId: v.id, quantity: quantities.get(v.id) as number }));
  const stored = await prisma.cartItem.findMany({ where: { userId }, select: { variationId: true, quantity: true } });
  if (!sameCartRows(stored, next)) {
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { userId } }),
      prisma.cartItem.createMany({ data: next.map((r) => ({ userId, ...r })) }),
    ]);
  }
  return NextResponse.json({ success: true, ...(rejected.length ? { rejected } : {}) });
}
