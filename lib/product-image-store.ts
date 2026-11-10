// Ürün fotoğrafı yükleme: doğrulama (sihirli baytlar) + işleme + Blob'a iki dosya (-k sonra -b). Blob istemcisi dışarıdan verilir (testte sahte).
import { createHash } from "node:crypto";
import { processProductImage } from "./product-image-process.ts";

/** Vercel fonksiyon gövde sınırı ~4,5 MB; çok parçalı gövde payı için dosya en çok 4 MiB. İstemci bu sınırın altına küçültür. */
export const MAX_ADMIN_IMAGE_BYTES = 4 * 1024 * 1024;
export const ADMIN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export interface BlobWriter {
  put(path: string, data: Buffer): Promise<string>;
}

export type StoreResult = { ok: true; url: string; smallUrl: string } | { ok: false; status: number; error: string };

/** İlk baytlardan gerçek tür (jpg/png/webp/avif); SVG ve diğerleri null. */
export function sniffImage(buf: Buffer): (typeof ADMIN_IMAGE_TYPES)[number] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(buf.toString("ascii", 8, 12))) return "image/avif";
  return null;
}

const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Blob yolu: urun/<productId>/<sha1>-b.webp (ürün henüz yoksa "yeni"). */
export function blobBasePath(productId: string | null | undefined, sha1: string): string {
  return `urun/${productId && PRODUCT_ID_RE.test(productId) ? productId : "yeni"}/${sha1}`;
}

/** Dosyayı doğrular, işler ve Blob'a yazar. Biri başarısız olursa URL DÖNMEZ (yarım kalan dosya ürüne bağlanmaz). */
export async function storeProductImage(file: unknown, productId: string | null | undefined, blob: BlobWriter): Promise<StoreResult> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, status: 400, error: "Dosya seçiniz." };
  if (file.size > MAX_ADMIN_IMAGE_BYTES) return { ok: false, status: 413, error: "Dosya en fazla 4 MB olabilir. Görsel tarayıcıda otomatik küçültülür; yine de büyükse daha küçük bir dosya seçin." };
  const input = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(input)) return { ok: false, status: 400, error: "Yalnızca JPG, PNG, WEBP veya AVIF görsel yüklenebilir." };
  let processed;
  try {
    processed = await processProductImage(input);
  } catch {
    return { ok: false, status: 400, error: "Görsel okunamadı; dosya bozuk olabilir." };
  }
  const base = blobBasePath(productId, createHash("sha1").update(processed.big).digest("hex"));
  try {
    const smallUrl = await blob.put(`${base}-k.webp`, processed.small);
    const url = await blob.put(`${base}-b.webp`, processed.big);
    return { ok: true, url, smallUrl };
  } catch {
    return { ok: false, status: 502, error: "Görsel depoya (Blob) yazılamadı; hiçbir şey kaydedilmedi. Biraz sonra tekrar deneyin." };
  }
}
