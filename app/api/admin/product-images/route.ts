import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-error";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { storeProductImage } from "@/lib/product-image-store";
import { realBlobWriter } from "@/lib/blob-writer";
import { deleteStaleOrphans } from "@/lib/product-images";
import { uploadedImageId } from "@/lib/variation-input";

// Tek dosya = tek istek. Dosya sihirli baytlarla doğrulanır, sharp ile işlenir (kare tuval) ve Vercel Blob'a -k ve -b olarak yazılır (2 yazma).
// Blob yazılamazsa Neon'a DÜŞÜLMEZ; yöneticiye açık hata döner. Dönen url "...-b.webp" (site -k sürümünü adresten türetir).
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-product-images", 120, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  try {
    const blob = realBlobWriter();
    if (!blob) return NextResponse.json({ error: "Görsel deposu (Blob) yapılandırılmamış: BLOB_READ_WRITE_TOKEN tanımlı değil. Yükleme yapılamadı." }, { status: 503 });
    const form = await req.formData().catch(() => null);
    const productId = form?.get("productId");
    const result = await storeProductImage(form?.get("file"), typeof productId === "string" ? productId : null, blob);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await deleteStaleOrphans().catch(() => {}); // eski (Neon) yetim yüklemeleri temizler
    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    return serverError("admin/product-images", error);
  }
}

// Form gönderimi iptal edilirse yüklenmiş ama ürüne bağlanmamış ESKİ (Neon) dosyaları temizler; Blob adresleri yok sayılır (silinmez)
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
