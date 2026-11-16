import { productPath } from "./product-url.ts";
import { SITE_NAME, SITE_URL } from "./site.ts";
import { displayTitle } from "./title-display.ts";

export interface ProductShareInput {
  id: string;
  title: string;
  category?: string | null;
  price?: number | null;
  url?: string | null;
  baseUrl?: string;
}

export interface ProductShareData {
  title: string;
  text: string;
  url: string;
  links: {
    whatsapp: string;
    facebook: string;
    x: string;
    email: string;
  };
}

/**
 * Paylaşım için temiz (sorgu ve #hash arındırılmış) ürün adresini üretir.
 * Geçerli bir http/https URL verilirse onun origin'i + kanonik ürün yolu kullanılır;
 * verilmezse veya bozuksa baseUrl (varsayılan SITE_URL) + kanonik ürün yolu döner.
 */
export function cleanShareUrl(
  rawUrl: string | null | undefined,
  product: { id: string; title?: string | null },
  baseUrl: string = SITE_URL
): string {
  const canonicalPath = productPath(product);
  const cleanBase = (baseUrl || SITE_URL).trim().replace(/\/+$/, "");
  if (rawUrl && typeof rawUrl === "string") {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return `${parsed.origin}${canonicalPath}`;
      }
    } catch {
      // Geçersiz adres: varsayılan site adresine düş
    }
  }
  return `${cleanBase}${canonicalPath}`;
}

/**
 * Ürün detay paylaşımı için başlık, kısa açıklama metni, temiz URL ve sosyal paylaşım bağlantılarını üretir.
 */
export function buildProductShare(input: ProductShareInput): ProductShareData {
  const cleanedTitle = displayTitle(input.title ?? "").title.trim() || (input.title ?? "").trim() || SITE_NAME;
  const url = cleanShareUrl(input.url, { id: input.id, title: input.title }, input.baseUrl);
  const hasValidPrice = typeof input.price === "number" && Number.isFinite(input.price) && input.price > 0;
  const pricePart = hasValidPrice
    ? `${input.price!.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
    : null;
  const categoryPart = input.category?.trim() ? input.category.trim() : null;

  const text = pricePart
    ? `${cleanedTitle} – ${pricePart} | ${SITE_NAME}`
    : categoryPart
      ? `${cleanedTitle} (${categoryPart}) | ${SITE_NAME}`
      : `${cleanedTitle} | ${SITE_NAME}`;

  const whatsappText = `${text}\n${url}`;
  const emailSubject = `${cleanedTitle} | ${SITE_NAME}`;
  const emailBody = `${text}\n\n${url}`;

  return {
    title: cleanedTitle,
    text,
    url,
    links: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
    },
  };
}

/** Kullanıcının yerleşik paylaşım penceresini kendi isteğiyle kapattığı (AbortError) durumu tespit eder. */
export function isShareAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return "name" in err && (err as { name?: unknown }).name === "AbortError";
}
