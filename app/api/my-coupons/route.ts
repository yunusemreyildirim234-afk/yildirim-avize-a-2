import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/account";
import { ensureDefaultCoupon } from "@/lib/coupons";

// Giriş yapmış müşterinin kullanabileceği kuponlar: herkese açık aktif kodlar + kendi e-postasına özel olanlar
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  await ensureDefaultCoupon();
  const rows = await prisma.coupon.findMany({
    where: { active: true, OR: [{ userEmail: null }, { userEmail: { equals: user.email, mode: "insensitive" } }] },
    include: { product: { select: { title: true, modelCode: true } } },
    orderBy: { createdAt: "asc" },
  });

  const coupons = rows
    .filter((c) => c.usedCount < c.maxUses)
    .map((c) => ({
      id: c.id,
      code: c.code,
      discountPercent: c.discountPercent,
      personal: Boolean(c.userEmail),
      remaining: c.maxUses >= 1_000_000 ? null : c.maxUses - c.usedCount, // null: sınırsız
      product: c.product ? { title: c.product.title, modelCode: c.product.modelCode } : null,
    }));
  // Kişisel kuponlar önce
  coupons.sort((a, b) => Number(b.personal) - Number(a.personal));
  return NextResponse.json({ coupons });
}
