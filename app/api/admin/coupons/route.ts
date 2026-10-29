import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Promosyon kodu yönetimi (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  const discountPercent = Number(body.discountPercent);
  const maxUses = Math.floor(Number(body.maxUses));
  const userEmail = typeof body.userEmail === "string" && body.userEmail.trim() ? body.userEmail.trim().toLowerCase() : null;
  const productId = typeof body.productId === "string" && body.productId ? body.productId : null;

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: "Kod 3-32 karakter olmalı (harf, rakam, - veya _)." }, { status: 400 });
  }
  if (!(discountPercent > 0 && discountPercent <= 100)) {
    return NextResponse.json({ error: "İndirim yüzdesi 1-100 arasında olmalı." }, { status: 400 });
  }
  if (!(maxUses >= 1)) return NextResponse.json({ error: "Kullanım limiti en az 1 olmalı." }, { status: 400 });
  if (await prisma.coupon.findUnique({ where: { code } })) {
    return NextResponse.json({ error: "Bu kod zaten mevcut." }, { status: 409 });
  }
  if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Seçilen ürün bulunamadı." }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({ data: { code, discountPercent, maxUses, userEmail, productId } });
  return NextResponse.json({ success: true, coupon });
}

// Pasife alma / yeniden aktifleştirme
export async function PATCH(req: Request) {
  const { id, active } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || typeof active !== "boolean") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  await prisma.coupon.update({ where: { id }, data: { active } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
