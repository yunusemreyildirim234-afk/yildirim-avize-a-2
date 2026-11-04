import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { IMAGE_MIMES, validateUpload } from "@/lib/uploads";
import { deleteStaleOrphans } from "@/lib/product-images";
import { UPLOADED_IMAGE_PREFIX, uploadedImageId } from "@/lib/variation-input";

// Tek dosya = tek istek (istek gövdesi sınırı). Dosya magic bytes/MIME/boyut ile doğrulanır.
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-product-images", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  try {
    const form = await req.formData().catch(() => null);
    const upload = await validateUpload(form?.get("file"), IMAGE_MIMES);
    if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });
    await deleteStaleOrphans().catch(() => {});
    const row = await prisma.productImage.create({ data: { mime: upload.mime, size: upload.data.length, data: upload.data }, select: { id: true } });
    return NextResponse.json({ success: true, url: `${UPLOADED_IMAGE_PREFIX}${row.id}` });
  } catch (error) {
    return serverError("admin/product-images", error);
  }
}

// Form gönderimi iptal edilirse yüklenmiş ama ürüne bağlanmamış dosyaları temizler (bağlı olanlara dokunmaz)
export async function DELETE(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const urls: unknown[] = Array.isArray(body.urls) ? body.urls.slice(0, 60) : [];
    const ids = urls.map((u) => (typeof u === "string" ? uploadedImageId(u) : null)).filter((x): x is string => Boolean(x));
    if (ids.length) await prisma.productImage.deleteMany({ where: { id: { in: ids }, productId: null } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("admin/product-images", error);
  }
}
