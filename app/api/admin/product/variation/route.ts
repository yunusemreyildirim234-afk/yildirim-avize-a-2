import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Tekil ürüne renk varyasyonu ekleme / silme (proxy yalnızca yöneticiye açar)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const value = typeof body.variationValue === "string" ? body.variationValue.trim().slice(0, 100) : "";
  const stock = Math.max(0, Math.floor(Number(body.stock) || 0));
  const extraPrice = Math.max(0, Number(body.extraPrice) || 0);
  if (!productId || !value) return NextResponse.json({ error: "Renk adı zorunludur." }, { status: 400 });

  const existing = await prisma.productVariation.findMany({ where: { productId }, select: { variationValue: true } });
  if (existing.some((v: { variationValue: string }) => v.variationValue.toLocaleLowerCase("tr") === value.toLocaleLowerCase("tr"))) {
    return NextResponse.json({ error: "Bu renk zaten ekli." }, { status: 409 });
  }

  const variation = await prisma.productVariation.create({
    data: { productId, variationType: "Renk", variationValue: value, stock, extraPrice },
  });
  return NextResponse.json({ success: true, variation });
}

export async function DELETE(req: Request) {
  const { variationId } = await req.json().catch(() => ({}));
  if (typeof variationId !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });

  const variation = await prisma.productVariation.findUnique({ where: { id: variationId }, select: { productId: true } });
  if (!variation) return NextResponse.json({ error: "Varyasyon bulunamadı." }, { status: 404 });

  const count = await prisma.productVariation.count({ where: { productId: variation.productId } });
  if (count <= 1) return NextResponse.json({ error: "Ürünün en az bir varyasyonu kalmalıdır." }, { status: 400 });

  const ordered = await prisma.orderItem.count({ where: { variationId } });
  if (ordered > 0) {
    return NextResponse.json({ error: "Bu renk için sipariş kaydı var; silmek yerine stoğunu 0 yapın." }, { status: 409 });
  }

  await prisma.productVariation.delete({ where: { id: variationId } });
  return NextResponse.json({ success: true });
}
