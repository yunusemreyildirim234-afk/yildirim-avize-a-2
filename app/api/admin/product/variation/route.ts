import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { attachUploads, pruneUploads } from "@/lib/product-images";
import { MAX_VARIATIONS, MAX_VARIATION_IMAGES, colorKey, isCompleteOrder, parseImageUrls, parseVariations, uploadedIdsOf } from "@/lib/variation-input";

class UploadMissing extends Error {}

// Tekil ürüne renk varyasyonu ekleme / fotoğraf güncelleme / silme (proxy yalnızca yöneticiye açar)
async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId : "";
    if (!productId) return NextResponse.json({ error: "Renk adı zorunludur." }, { status: 400 });
    // Aynı doğrulama kuralları (ad boş/uzun olamaz, stok 0-99999 tam sayı, fark sınırı, en fazla 5 fotoğraf)
    const parsed = parseVariations([{ name: body.variationValue, stock: body.stock ?? 0, extraPrice: body.extraPrice ?? 0, images: body.images }]);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value[0];

    const existing = await prisma.productVariation.findMany({ where: { productId }, select: { variationValue: true, position: true } });
    if (existing.length >= MAX_VARIATIONS) return NextResponse.json({ error: `En fazla ${MAX_VARIATIONS} renk eklenebilir.` }, { status: 400 });
    if (existing.some((e: { variationValue: string }) => colorKey(e.variationValue) === colorKey(v.name))) {
      return NextResponse.json({ error: "Bu renk zaten ekli." }, { status: 409 });
    }
    const position = existing.reduce((m: number, e: { position: number }) => Math.max(m, e.position), -1) + 1;

    const variation = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariation.create({ data: { productId, variationType: "Renk", variationValue: v.name, stock: v.stock, extraPrice: v.extraPrice, images: v.images, position } });
      if (!(await attachUploads(tx, productId, uploadedIdsOf(v.images)))) throw new UploadMissing();
      return created;
    }).catch((e) => {
      if (e instanceof UploadMissing) return null;
      throw e;
    });
    if (!variation) return NextResponse.json({ error: "Yüklenen fotoğraflardan biri bulunamadı veya süresi doldu." }, { status: 400 });
    return NextResponse.json({ success: true, variation });
  } catch (error) {
    return serverError("admin/product/variation", error);
  }
}

// Rengin fotoğraflarını değiştirir (sıra korunur; ilk fotoğraf kapak olur) ya da ürünün renk sırasını kaydeder ({ productId, order })
async function PATCHHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    // Renk sırası: tek istekte position = dizideki sıra (0..n-1)
    if (typeof body.productId === "string" && "order" in body) {
      const rows = await prisma.productVariation.findMany({ where: { productId: body.productId }, select: { id: true } });
      if (!isCompleteOrder(body.order, rows.map((r: { id: string }) => r.id))) return NextResponse.json({ error: "Renk sırası geçersiz: ürünün tüm renkleri bir kez yer almalı." }, { status: 400 });
      const order: string[] = body.order;
      await prisma.$transaction(order.map((id, position) => prisma.productVariation.update({ where: { id }, data: { position } })));
      return NextResponse.json({ success: true });
    }
    if (typeof body.variationId !== "string") return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    const images = parseImageUrls(body.images, MAX_VARIATION_IMAGES, "Renk fotoğrafları");
    if (!images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
    const current = await prisma.productVariation.findUnique({ where: { id: body.variationId }, select: { productId: true } });
    if (!current) return NextResponse.json({ error: "Varyasyon bulunamadı." }, { status: 404 });
    const ok = await prisma.$transaction(async (tx) => {
      if (!(await attachUploads(tx, current.productId, uploadedIdsOf(images.value)))) throw new UploadMissing();
      await tx.productVariation.update({ where: { id: body.variationId }, data: { images: images.value } });
      await pruneUploads(tx, current.productId);
      return true;
    }).catch((e) => {
      if (e instanceof UploadMissing) return false;
      throw e;
    });
    if (!ok) return NextResponse.json({ error: "Yüklenen fotoğraflardan biri bulunamadı veya başka bir ürüne ait." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("admin/product/variation", error);
  }
}

async function DELETEHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
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

    await prisma.$transaction(async (tx) => {
      await tx.productVariation.delete({ where: { id: variationId } });
      await pruneUploads(tx, variation.productId);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("admin/product/variation", error);
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);
export const PATCH = withStorefrontRevalidate(PATCHHandler);
export const DELETE = withStorefrontRevalidate(DELETEHandler);
