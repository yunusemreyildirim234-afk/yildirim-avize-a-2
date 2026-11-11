import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";
import { revalidateStorefront } from "@/lib/revalidate";
import { realBlobWriter } from "@/lib/blob-writer";
import { processProductImage } from "@/lib/product-image-process";
import { copyBatch, fetchTrendyolImage, isTrendyolUrl } from "@/lib/image-copy";
import { prismaCopyStore } from "@/lib/image-copy-store";

// Parti ~25 sn süre bütçesi + son görselin indirme/işleme payı; Vercel işlevi bunun üstünde kesilmez.
export const maxDuration = 60;

// Bekleyen Trendyol görsellerinden küçük bir parti Blob'a kopyalar ve ürüne koşullu yazar. İstemci, kalan 0 olana dek tekrar çağırır.
// Gövde: { atla?: string[] } — istemcinin bu koşuda zaten hata aldığı adresler (aynı hatalı görselde takılmamak için).
// Gövde: { bitir: true } — kopyalama yapmaz; döngü sonunda vitrini BİR kez yeniler (her partide tüm vitrin önbelleği boşaltılmaz).
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-gorsel-kopyala", 60, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const blob = realBlobWriter();
  if (!blob) return NextResponse.json({ error: "Görsel deposu (Blob) ayarlı değil; BLOB_READ_WRITE_TOKEN tanımlanmalı." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (body?.bitir === true) {
    revalidateStorefront();
    return NextResponse.json({ success: true, yenilendi: true });
  }
  const atla = new Set<string>(Array.isArray(body?.atla) ? body.atla.filter(isTrendyolUrl).slice(0, 2000) : []);
  try {
    const r = await copyBatch(
      prismaCopyStore,
      { fetchImage: (u) => fetchTrendyolImage(u), process: async (b) => { const o = await processProductImage(b); return { big: o.big, small: o.small }; }, blob, now: () => Date.now() },
      { atla },
    );
    return NextResponse.json({ success: true, ...r });
  } catch (error) {
    return serverError("admin/gorsel-kopyala", error, "Görseller kopyalanamadı. Lütfen tekrar deneyin.", 502);
  }
}
