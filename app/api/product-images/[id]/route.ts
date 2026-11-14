import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { IMAGE_MIMES } from "@/lib/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Yüklenen ürün/renk fotoğrafı: herkese açık, kimlik tahmin edilemez (uuid), içerik değişmez
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(req, "product-image", 300, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Bulunamadı", { status: 404 });
  const image = await prisma.productImage.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!image || !(IMAGE_MIMES as readonly string[]).includes(image.mime)) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.data.length),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
