import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 1. Yeni Avize Ekleme (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, category, basePrice, imageUrl, variationType, variationValue, stock } = body;
    let modelCode: string | null = typeof body.modelCode === "string" ? body.modelCode.trim().slice(0, 40) : "";
    if (!modelCode) {
      // Boş bırakılırsa mevcut en büyük sayısal koddan sonraki numara verilir
      const codes = await prisma.product.findMany({ where: { modelCode: { not: null } }, select: { modelCode: true } });
      const max = codes.reduce((m: number, c: { modelCode: string | null }) => Math.max(m, Number(c.modelCode) || 0), 0);
      modelCode = String(max + 1);
    } else if (await prisma.product.findUnique({ where: { modelCode } })) {
      return NextResponse.json({ error: `"${modelCode}" model kodu başka bir üründe kullanılıyor.` }, { status: 409 });
    }

    const newProduct = await prisma.product.create({
      data: {
        title,
        description,
        category,
        basePrice: parseFloat(basePrice) || 0,
        imageUrl: imageUrl || null,
        modelCode,
        variations: {
          create: [
            {
              variationType: variationType || "Seçenek",
              variationValue: variationValue || "Standart",
              extraPrice: 0,
              stock: parseInt(stock) || 10,
            },
          ],
        },
      },
    });

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// 2. Stok Adedini Güncelleme (PATCH)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    // Site model kodu güncelleme (boş bırakılırsa kod kaldırılır)
    if (typeof body.productId === "string" && "modelCode" in body) {
      const modelCode = typeof body.modelCode === "string" ? body.modelCode.trim().slice(0, 40) : "";
      if (modelCode) {
        const clash = await prisma.product.findUnique({ where: { modelCode }, select: { id: true } });
        if (clash && clash.id !== body.productId) {
          return NextResponse.json({ error: `"${modelCode}" model kodu başka bir üründe kullanılıyor.` }, { status: 409 });
        }
      }
      const product = await prisma.product.update({ where: { id: body.productId }, data: { modelCode: modelCode || null } });
      return NextResponse.json({ success: true, product });
    }

    const { variationId, stock } = body;

    const updated = await prisma.productVariation.update({
      where: { id: variationId },
      data: { stock: Math.max(0, parseInt(stock) || 0) },
    });

    return NextResponse.json({ success: true, variation: updated });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// 3. Avizeyi Güvenle Silme (DELETE)
export async function DELETE(req: Request) {
  try {
    const { productId } = await req.json();

    // Bağlı varyasyonları bul
    const variations = await prisma.productVariation.findMany({
      where: { productId },
      select: { id: true },
    });
    const variationIds = variations.map((v) => v.id);

    // Varsa bağlı sipariş kalemlerini ve varyasyonları temizle
    await prisma.orderItem.deleteMany({
      where: { variationId: { in: variationIds } },
    });
    await prisma.productVariation.deleteMany({
      where: { productId },
    });

    // Avizeyi veritabanından tamamen sil
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}