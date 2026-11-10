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

const ADMIN_TARGET_BYTES = 3.9 * 1024 * 1024; // sunucu sınırı 4 MiB (lib/product-image-store.ts); Vercel gövde sınırı ~4,5 MB
const ADMIN_MAX_SIDE = 2400;

/**
 * Yönetici ürün fotoğrafı: telefon fotoğrafları gövde sınırını aşmasın diye yüklemeden önce en çok 2400 px / kalite 0.9 WebP'ye indirir
 * (gerekirse boyut ve kalite kademeli düşer). Zaten küçükse dosya aynen döner. Sığdıramazsa Türkçe hata fırlatır.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size > MAX_RAW_BYTES) throw new Error(`"${file.name}" çok büyük (en fazla 20 MB).`);
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error(`"${file.name}" okunamadı. JPG, PNG, WEBP veya AVIF görsel seçin (HEIC desteklenmez).`);
  }
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  if (file.size <= ADMIN_TARGET_BYTES && longSide <= ADMIN_MAX_SIDE && /^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
  for (const [side, quality] of [[ADMIN_MAX_SIDE, 0.9], [ADMIN_MAX_SIDE, 0.8], [2000, 0.8], [1600, 0.7]] as const) {
    const scale = Math.min(1, side / longSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#fff"; // saydam PNG → JPEG yedeğinde siyah olmasın
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob || blob.size > ADMIN_TARGET_BYTES) continue;
    const base = file.name.replace(/\.[^.]+$/, "") || "gorsel";
    return new File([blob], `${base}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type, lastModified: Date.now() });
  }
  throw new Error(`"${file.name}" 4 MB altına küçültülemedi. Daha küçük bir görsel seçin.`);
}
