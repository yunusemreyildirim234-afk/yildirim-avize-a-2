import { put } from "@vercel/blob";
import type { BlobWriter } from "@/lib/product-image-store";

const YEAR = 365 * 24 * 60 * 60;

/** Gerçek Vercel Blob yazıcısı. Token yoksa null (çağıran açık hata döner; Neon'a düşülmez). Yol içerik özetli olduğundan aynı dosya üzerine yazılabilir. */
export function realBlobWriter(): BlobWriter | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return {
    async put(path, data) {
      const r = await put(path, data, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp", cacheControlMaxAge: YEAR, token });
      return r.url;
    },
  };
}
