// Yönetici paneli (yalnızca istemci): ürün/renk fotoğrafı yükleme. Her dosya AYRI istektir; küçültme lib/client-image.ts ile yapılır.
import { shrinkForUpload } from "@/lib/client-image";
import { downloadBaseName } from "@/lib/image-list";

export interface PickerItem {
  key: string;
  src: string; // yüklenmiş adres ya da yerel önizleme (blob:)
  file?: File; // varsa henüz yüklenmemiştir
}

let counter = 0;
export const newKey = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

export const itemsFromFiles = (files: File[]): PickerItem[] => files.map((file) => ({ key: newKey(), src: URL.createObjectURL(file), file }));
export const itemsFromUrls = (urls: string[]): PickerItem[] => urls.map((src) => ({ key: newKey(), src }));
export const releaseItem = (i: PickerItem) => {
  if (i.file) URL.revokeObjectURL(i.src);
};

/** Yönetici uyarısı: her yükleme Blob'a iki dosya (-b ve -k) yazar. */
export const UPLOAD_QUOTA_NOTE = "Aylık yükleme hakkı: 2000.";

/** Dosyayı (gerekirse ~2400 px WebP'ye küçültüp) Blob'a yükler; kare tuvali ve -b/-k üretimini sunucu yapar. Dönen: "...-b.webp" adresi. */
export async function uploadFile(file: File, productId?: string): Promise<string> {
  const small = await shrinkForUpload(file);
  const form = new FormData();
  form.append("file", small);
  if (productId) form.append("productId", productId);
  const res = await fetch("/api/admin/product-images", { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error(`"${file.name}" yüklenemedi: bağlantı hatası.`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== "string") throw new Error(data.error || (res.status === 413 ? `"${file.name}" çok büyük (en fazla 4 MB).` : `"${file.name}" yüklenemedi.`));
  return data.url;
}

/** Görseli indirir. Blob başka kaynaktır: önce fetch ile adlı indirme, olmazsa ?download=1 adresi. */
export async function downloadImage(url: string, productTitle: string, index: number) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "webp").replace("jpeg", "jpg");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${downloadBaseName(productTitle, index)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url.startsWith("http") ? `${url}${url.includes("?") ? "&" : "?"}download=1` : url, "_blank", "noopener");
  }
}

/** Ürüne bağlanmamış yüklemeleri siler (form iptal/hata); sessizce başarısız olabilir. Yalnızca eski (Neon) yüklemeler silinir; Blob dosyalarına dokunulmaz. */
export async function discardUploaded(urls: string[]) {
  if (urls.length === 0) return;
  await fetch("/api/admin/product-images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) }).catch(() => {});
}
