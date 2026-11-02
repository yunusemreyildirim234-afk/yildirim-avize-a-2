// Sunucu tarafı dosya yükleme doğrulaması (dekont ve yorum fotoğrafı)
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RECEIPT_MIMES = [...IMAGE_MIMES, "application/pdf"] as const;

/** Dosyanın ilk baytlarından gerçek türünü doğrular (istemcinin bildirdiği MIME'a güvenilmez). */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export type UploadResult = { ok: true; mime: string; data: Buffer<ArrayBuffer> } | { ok: false; error: string };

export async function validateUpload(file: unknown, allowed: readonly string[]): Promise<UploadResult> {
  const label = allowed.includes("application/pdf") ? "görsel (JPG, PNG, WEBP) veya PDF" : "görsel (JPG, PNG, WEBP)";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Dosya seçiniz." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Dosya en fazla 5 MB olabilir." };
  if (!allowed.includes(file.type)) return { ok: false, error: `Yalnızca ${label} yüklenebilir.` };
  const data = Buffer.from(await file.arrayBuffer());
  const real = sniff(data);
  if (!real || real !== file.type || !allowed.includes(real)) return { ok: false, error: `Dosya içeriği geçerli bir ${label} değil.` };
  return { ok: true, mime: real, data };
}
