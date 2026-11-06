import { NextResponse } from "next/server";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { resolveCategoryForSave } from "@/lib/category-list";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { attachUploads, pruneUploads } from "@/lib/product-images";
import { MAX_PRODUCT_IMAGES, parseImageUrls, parseVariations, uploadedIdsOf } from "@/lib/variation-input";
import { normalizeEbat } from "@/lib/listing-core";
import { schedulePriceDrops } from "@/lib/price-drop-notify";
import { buildUndoToken, snapshotForDelete, snapshotProducts } from "@/lib/admin-undo";

// 1. Yeni Avize Ekleme (POST): ürün + tüm renkler TEK transaction'da; fotoğraflar önceden /api/admin/product-images ile yüklenir
const isUniqueError = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
    if (!title) return NextResponse.json({ error: "Avize adı boş olamaz." }, { status: 400 });
    const categoryInput = typeof body.category === "string" ? body.category.trim().slice(0, 60) : "";
    const category = categoryInput ? await resolveCategoryForSave(categoryInput) : ""; // mevcut kategoriyle harf farkı varsa mevcut yazım; yeniyse başlık biçimi
    if (!category) return NextResponse.json({ error: "Kategori seçiniz." }, { status: 400 });
    const basePrice = Number(body.basePrice);
    if (!Number.isFinite(basePrice) || basePrice <= 0 || basePrice > 10_000_000) return NextResponse.json({ error: "Geçerli bir satış fiyatı giriniz." }, { status: 400 });
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 10_000) || null : null;

    const ebat = normalizeEbat(body.ebat);
    if (!ebat.ok) return NextResponse.json({ error: ebat.error }, { status: 400 });

    const images = parseImageUrls(body.images, MAX_PRODUCT_IMAGES, "Ürün fotoğrafları");
    if (!images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
    const variations = parseVariations(body.variations);
    if (!variations.ok) return NextResponse.json({ error: variations.error }, { status: 400 });

    const manualCode = typeof body.modelCode === "string" ? body.modelCode.trim().slice(0, 40) : "";
    if (manualCode && (await prisma.product.findUnique({ where: { modelCode: manualCode }, select: { id: true } }))) {
      return NextResponse.json({ error: `"${manualCode}" model kodu başka bir üründe kullanılıyor.` }, { status: 409 });
    }
    const uploadIds = uploadedIdsOf(images.value, ...variations.value.map((v) => v.images));

    // Otomatik model kodu: aynı anda iki ürün eklenirse unique çakışması olur; çakışmada kodu yeniden hesaplayıp tekrar dener
    for (let attempt = 0; attempt < 5; attempt++) {
      let modelCode = manualCode;
      if (!modelCode) {
        const codes = await prisma.product.findMany({ where: { modelCode: { not: null } }, select: { modelCode: true } });
        modelCode = String(codes.reduce((m: number, c: { modelCode: string | null }) => Math.max(m, Number(c.modelCode) || 0), 0) + 1);
      }
      try {
        const created = await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              title,
              description,
              category,
              basePrice,
              imageUrl: images.value[0] ?? null,
              images: images.value,
              modelCode,
              ebat: ebat.value,
              variations: {
                create: variations.value.map((v, i) => ({ variationType: "Renk", variationValue: v.name, extraPrice: v.extraPrice, stock: v.stock, images: v.images, position: i })),
              },
            },
          });
          if (!(await attachUploads(tx, product.id, uploadIds))) throw new UploadMissing();
          return product;
        });
        return NextResponse.json({ success: true, product: created });
      } catch (e) {
        if (e instanceof UploadMissing) return NextResponse.json({ error: "Yüklenen fotoğraflardan biri bulunamadı veya süresi doldu. Lütfen fotoğrafları yeniden ekleyin." }, { status: 400 });
        if (isUniqueError(e)) {
          if (manualCode) return NextResponse.json({ error: `"${manualCode}" model kodu başka bir üründe kullanılıyor.` }, { status: 409 });
          continue;
        }
        throw e;
      }
    }
    return NextResponse.json({ error: "Model kodu üretilemedi, lütfen tekrar deneyin." }, { status: 409 });
  } catch (error) {
    return serverError("admin/product", error);
  }
}

class UploadMissing extends Error {}

// 2. Stok Adedini Güncelleme (PATCH)
async function PATCHHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json();

    // Tekil ürün düzenleme: başlık, fiyat, görseller (varsa model kodu ile birlikte)
    if (typeof body.productId === "string" && ("title" in body || "basePrice" in body || "images" in body || "modelCode" in body || "isFeatured" in body || "isBestSeller" in body || "ebat" in body)) {
      const data: { title?: string; basePrice?: number; images?: string[]; imageUrl?: string | null; modelCode?: string | null; isFeatured?: boolean; isBestSeller?: boolean; ebat?: string | null } = {};
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
      if ("ebat" in body) {
        const ebat = normalizeEbat(body.ebat);
        if (!ebat.ok) return NextResponse.json({ error: ebat.error }, { status: 400 });
        data.ebat = ebat.value;
      }
      if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured;
      if (typeof body.isBestSeller === "boolean") data.isBestSeller = body.isBestSeller;
      if (Array.isArray(body.images)) {
        // Trendyol'dan gelen ürünlerde 10'dan çok görsel olabilir (eski üst sınır 20); yüklenen görseller en fazla 10
        const parsed = parseImageUrls(body.images, 20, "Ürün fotoğrafları");
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        if (uploadedIdsOf(parsed.value).length > MAX_PRODUCT_IMAGES) return NextResponse.json({ error: `Yüklenen ürün fotoğrafı en fazla ${MAX_PRODUCT_IMAGES} olabilir.` }, { status: 400 });
        data.images = parsed.value;
        data.imageUrl = parsed.value[0] ?? null;
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
      const oldBase = data.basePrice !== undefined ? (await prisma.product.findUnique({ where: { id: body.productId }, select: { basePrice: true } }))?.basePrice : undefined;
      const product = await prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({ where: { id: body.productId }, data });
        if (data.images) {
          if (!(await attachUploads(tx, body.productId, uploadedIdsOf(data.images)))) throw new UploadMissing();
          await pruneUploads(tx, body.productId);
        }
        return updated;
      }).catch((e) => {
        if (e instanceof UploadMissing) return null;
        throw e;
      });
      if (!product) return NextResponse.json({ error: "Yüklenen fotoğraflardan biri bulunamadı veya başka bir ürüne ait." }, { status: 400 });
      // Fiyat düştüyse favorileyen üyelere bildirim (yanıttan sonra; hata kaydı bozmaz)
      if (oldBase !== undefined && data.basePrice !== undefined) schedulePriceDrops([{ productId: body.productId, oldPrice: oldBase, newPrice: data.basePrice }]);
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

    const owner = await prisma.productVariation.findUnique({ where: { id: variationId }, select: { productId: true, extraPrice: true, product: { select: { basePrice: true } } } });
    const before = owner ? await snapshotProducts([owner.productId]) : [];
    const updated = await prisma.productVariation.update({
      where: { id: variationId },
      data: {
        stock: Math.max(0, parseInt(stock) || 0),
        ...(body.extraPrice !== undefined && Number(body.extraPrice) >= 0 ? { extraPrice: Number(body.extraPrice) } : {}),
      },
    });

    if (owner && body.extraPrice !== undefined && Number(body.extraPrice) >= 0) {
      schedulePriceDrops([{ productId: owner.productId, oldPrice: owner.product.basePrice + owner.extraPrice, newPrice: owner.product.basePrice + updated.extraPrice }]);
    }
    return NextResponse.json({ success: true, variation: updated, snapshot: before.length ? await buildUndoToken(before) : null });
  } catch (error) {
    return serverError("admin/product", error);
  }
}

// 3. Avizeyi Güvenle Silme (DELETE)
async function DELETEHandler(req: Request) {
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

    // Yüklenmiş görseller cascade ile silinmesin: ürüne bağsız bırakılır (Geri Al 30 dk içinde yeniden bağlar, 24 saat sonra yetim temizliği siler)
    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId }, data: { productId: null } }),
      prisma.productVariation.deleteMany({ where: { productId } }),
      prisma.product.delete({ where: { id: productId } }),
    ]);

    return NextResponse.json({ success: true, snapshot: await buildUndoToken(before, fullCopy) });
  } catch (error) {
    return serverError("admin/product", error);
  }
}

export const POST = withStorefrontRevalidate(POSTHandler);
export const PATCH = withStorefrontRevalidate(PATCHHandler);
export const DELETE = withStorefrontRevalidate(DELETEHandler);
