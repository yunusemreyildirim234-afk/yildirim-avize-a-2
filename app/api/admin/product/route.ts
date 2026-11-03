import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { buildUndoToken, snapshotForDelete, snapshotProducts } from "@/lib/admin-undo";

// 1. Yeni Avize Ekleme (POST)
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
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
    return serverError("admin/product", error);
  }
}

// 2. Stok Adedini Güncelleme (PATCH)
export async function PATCH(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json();

    // Tekil ürün düzenleme: başlık, fiyat, görseller (varsa model kodu ile birlikte)
    if (typeof body.productId === "string" && ("title" in body || "basePrice" in body || "images" in body || "modelCode" in body || "isFeatured" in body || "isBestSeller" in body)) {
      const data: { title?: string; basePrice?: number; images?: string[]; imageUrl?: string | null; modelCode?: string | null; isFeatured?: boolean; isBestSeller?: boolean } = {};
      if (typeof body.title === "string") {
        const title = body.title.trim().slice(0, 300);
        if (!title) return NextResponse.json({ error: "Ürün başlığı boş olamaz." }, { status: 400 });
        data.title = title;
      }
      if ("basePrice" in body) {
        const price = Number(body.basePrice);
        if (!(price >= 0)) return NextResponse.json({ error: "Geçerli bir fiyat giriniz." }, { status: 400 });
        data.basePrice = price;
      }
      if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured;
      if (typeof body.isBestSeller === "boolean") data.isBestSeller = body.isBestSeller;
      if (Array.isArray(body.images)) {
        const images: string[] = body.images
          .filter((u: unknown): u is string => typeof u === "string")
          .map((u: string) => u.trim())
          .filter((u: string) => /^(https?:\/\/|\/)/.test(u))
          .slice(0, 20);
        data.images = images;
        data.imageUrl = images[0] ?? null;
      }
      if ("modelCode" in body) {
        const modelCode = typeof body.modelCode === "string" ? body.modelCode.trim().slice(0, 40) : "";
        if (modelCode) {
          const clash = await prisma.product.findUnique({ where: { modelCode }, select: { id: true } });
          if (clash && clash.id !== body.productId) {
            return NextResponse.json({ error: `"${modelCode}" model kodu başka bir üründe kullanılıyor.` }, { status: 409 });
          }
        }
        data.modelCode = modelCode || null;
      }
      const before = await snapshotProducts([body.productId]);
      const product = await prisma.product.update({ where: { id: body.productId }, data });
      return NextResponse.json({ success: true, product, snapshot: await buildUndoToken(before) });
    }

    // Eski kısa yol: yalnızca model kodu
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

    const owner = await prisma.productVariation.findUnique({ where: { id: variationId }, select: { productId: true } });
    const before = owner ? await snapshotProducts([owner.productId]) : [];
    const updated = await prisma.productVariation.update({
      where: { id: variationId },
      data: {
        stock: Math.max(0, parseInt(stock) || 0),
        ...(body.extraPrice !== undefined && Number(body.extraPrice) >= 0 ? { extraPrice: Number(body.extraPrice) } : {}),
      },
    });

    return NextResponse.json({ success: true, variation: updated, snapshot: before.length ? await buildUndoToken(before) : null });
  } catch (error) {
    return serverError("admin/product", error);
  }
}

// 3. Avizeyi Güvenle Silme (DELETE)
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { productId } = await req.json();

    if (typeof productId !== "string") return NextResponse.json({ error: "productId zorunlu" }, { status: 400 });

    // Geçmiş siparişi olan ürün silinmez: pasife alınır ve stokları sıfırlanır (sipariş geçmişi korunur)
    const before = await snapshotProducts([productId]);
    const fullCopy = await snapshotForDelete(productId);
    const hasOrders = await prisma.orderItem.findFirst({ where: { variation: { productId } }, select: { id: true } });
    if (hasOrders) {
      await prisma.$transaction([
        prisma.product.update({ where: { id: productId }, data: { active: false } }),
        prisma.productVariation.updateMany({ where: { productId }, data: { stock: 0 } }),
      ]);
      return NextResponse.json({ success: true, snapshot: await buildUndoToken(before), deactivated: true, message: "Ürünün geçmiş siparişleri olduğu için silinmedi; pasife alındı." });
    }

    await prisma.productVariation.deleteMany({
      where: { productId },
    });

    // Avizeyi veritabanından tamamen sil
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true, snapshot: await buildUndoToken(before, fullCopy) });
  } catch (error) {
    return serverError("admin/product", error);
  }
}