// Google Merchant Center ürün feed'i için SAF yardımcılar (veritabanı/ağ yok). Fiyat ve stok, ürün sayfasındaki
// (components/ProductDetailClient.tsx) varsayılan seçimle birebir aynıdır: kupon, Havale, mağaza ve adet indirimleri YOK.

export const FEED_BRAND_FALLBACK = "Yıldırım Avize";
export const FEED_DESCRIPTION_MAX = 5000;
export const FEED_TITLE_MAX = 150;
export const FEED_EXTRA_IMAGES = 10;
const CHANDELIERS = "Home & Garden > Lighting > Light Fixtures > Chandeliers";
const ACCESSORIES = "Home & Garden > Lighting > Lighting Accessories";

export interface FeedVariation {
  extraPrice: number;
  stock: number;
  barcode?: string | null;
  images?: string[];
}
export interface FeedProduct {
  id: string;
  title: string;
  description: string | null;
  category: string;
  basePrice: number;
  listPrice: number | null;
  imageUrl: string | null;
  images: string[];
  brand: string | null;
  variations: FeedVariation[];
}

/** XML 1.0'da geçersiz karakterleri (kontrol, yalnız vekil, U+FFFE/FFFF) atar, sonra &, <, >, ", ' kaçırır. */
export function xmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML'i düz metne çevirir (etiketler atılır, temel varlıklar çözülür, boşluklar tekleşir) ve kod noktası bazında kısaltır. */
export function cleanText(html: string | null | undefined, max = FEED_DESCRIPTION_MAX): string {
  const text = (html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  return [...text].slice(0, max).join("").trim();
}

/** "1234.00 TRY" (nokta ondalık, iki hane); geçersiz/≤0 değerde null. */
export function feedPrice(n: number): string | null {
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(2)} TRY` : null;
}

/** GTIN: yalnızca 8/12/13/14 haneli ve sağlama (mod 10) basamağı doğru olan değerler. */
export function validGtin(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return null;
  const d = [...s].map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? s : null;
}

/** Mutlak https adresi: "/yol" → site kökü eklenir; http, veri URL'si, boş değer atılır. */
export function absoluteHttps(u: string | null | undefined, site: string): string | null {
  const s = (u ?? "").trim();
  if (!s) return null;
  const full = s.startsWith("/") && !s.startsWith("//") ? `${site}${s}` : s;
  if (!/^https:\/\/[^\s]+$/i.test(full)) return null;
  return full;
}

/** Ürün sayfasının varsayılan seçimiyle aynı: ilk stoklu varyasyon (yoksa ilki); görünen fiyat = taban + fark; üstü çizili liste fiyatı yalnız taban fiyattan yüksekse. */
export function defaultOffer<V extends FeedVariation>(p: { basePrice: number; listPrice: number | null; variations: V[] }) {
  const v = p.variations.find((x) => x.stock > 0) ?? p.variations[0] ?? null;
  const extra = v?.extraPrice ?? 0;
  const price = p.basePrice + extra;
  const list = p.listPrice && p.listPrice > p.basePrice ? p.listPrice + extra : null;
  return { variation: v, price, list: list && list > price ? list : null, inStock: p.variations.some((x) => x.stock > 0) };
}

/** Feed bağlantıları kanonik www adresini kullanır (ortam değişkeni www'suz ise de): yildirimavize.com.tr → www.yildirimavize.com.tr */
export const feedSite = (u: string) => u.replace(/^(https:\/\/)(yildirimavize\.com\.tr)(?=\/|$)/i, "$1www.$2").replace(/\/$/, "");

export const feedBrand = (b: string | null | undefined) => b?.trim() || FEED_BRAND_FALLBACK;

export function googleCategory(category: string): string {
  return category.trim().toLocaleLowerCase("tr-TR") === "aksesuar" ? ACCESSORIES : CHANDELIERS;
}

const tag = (name: string, value: string) => `<g:${name}>${xmlEscape(value)}</g:${name}>`;

/** Tek ürün için <item> bloğu; görseli ya da geçerli fiyatı olmayan ürün null (Merchant Center zaten reddeder). */
export function feedItemXml(p: FeedProduct, site: string): string | null {
  const offer = defaultOffer(p);
  const shown = feedPrice(offer.price);
  // Kapak: varsayılan (ilk stoklu) varyasyonun görseli varsa o, yoksa ürün kapağı (ürün sayfası JsonLd'i ile aynı kural)
  const images = [...new Set([offer.variation?.images?.[0], p.imageUrl, ...p.images].map((u) => absoluteHttps(u, site)).filter((u): u is string => Boolean(u)))];
  if (!shown || images.length === 0) return null;
  const regular = offer.list ? feedPrice(offer.list) : null;
  const title = cleanText(p.title, FEED_TITLE_MAX) || FEED_BRAND_FALLBACK;
  const description = cleanText(p.description) || `${title} – ${FEED_BRAND_FALLBACK} Beyoğlu Şişhane`;
  const gtin = validGtin(offer.variation?.barcode);
  const lines = [
    tag("id", p.id),
    `<title>${xmlEscape(title)}</title>`,
    `<description>${xmlEscape(description)}</description>`,
    `<link>${xmlEscape(`${site}/urun/${p.id}`)}</link>`,
    tag("image_link", images[0]),
    ...images.slice(1, 1 + FEED_EXTRA_IMAGES).map((u) => tag("additional_image_link", u)),
    tag("availability", offer.inStock ? "in_stock" : "out_of_stock"),
    tag("price", regular ?? shown),
    ...(regular ? [tag("sale_price", shown)] : []),
    tag("brand", feedBrand(p.brand)),
    tag("condition", "new"),
    tag("google_product_category", googleCategory(p.category)),
    tag("product_type", p.category),
    ...(gtin ? [tag("gtin", gtin)] : [tag("identifier_exists", "no")]),
  ];
  return `<item>${lines.join("")}</item>`;
}

export const FEED_HEAD = (site: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Yıldırım Avize</title><link>${xmlEscape(site)}</link><description>Yıldırım Avize ürün listesi</description>`;
export const FEED_TAIL = "</channel></rss>\n";
