// Yönetici paneli (yalnızca istemci): ürün/renk fotoğrafı yükleme. Her dosya AYRI istektir; sıkıştırma lib/client-image.ts ile yapılır.
import { compressImageToWebP } from "@/lib/client-image";

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

/** Dosyayı ~1600px WebP'ye sıkıştırır ve yükler; yüklenen görselin göreli adresini döndürür. */
export async function uploadFile(file: File): Promise<string> {
  const small = await compressImageToWebP(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.78 });
  const form = new FormData();
  form.append("file", small);
  const res = await fetch("/api/admin/product-images", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.url !== "string") throw new Error(data.error || `"${file.name}" yüklenemedi.`);
  return data.url;
}

/** Ürüne bağlanmamış yüklemeleri siler (form iptal/hata); sessizce başarısız olabilir, kalanlar 24 saatte temizlenir. */
export async function discardUploaded(urls: string[]) {
  if (urls.length === 0) return;
  await fetch("/api/admin/product-images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) }).catch(() => {});
}
