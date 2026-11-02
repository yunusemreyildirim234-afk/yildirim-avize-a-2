// Tarayıcı tarafı görsel sıkıştırma (yalnızca istemcide kullanın; harici kütüphane yok)
export const MAX_RAW_BYTES = 20 * 1024 * 1024; // sıkıştırma öncesi ham dosya üst sınırı
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024; // Vercel istek gövdesi sınırı
const SKIP_BELOW_BYTES = 300 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Görseli en-boy oranını koruyarak küçültür ve WebP'ye çevirir (WebP desteklenmezse JPEG).
 * PDF, 300 KB altı dosyalar ve hata durumlarında orijinal dosya döner.
 */
export async function compressImageToWebP(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options;
  if (file.type === "application/pdf" || file.size < SKIP_BELOW_BYTES || !file.type.startsWith("image/")) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await toBlob(canvas, "image/webp", quality);
    // Tarayıcı WebP üretemezse toBlob PNG döndürür; bu durumda JPEG'e düş
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) return file;
    // Sıkıştırma büyüttüyse orijinali koru
    if (blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "gorsel";
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
