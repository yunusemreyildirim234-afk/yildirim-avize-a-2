// Hızlı ürün girişi: renk/varyasyon ve fotoğraf girdisi için SAF sunucu doğrulaması (içe aktarma yok; istemciye güvenilmez).

export const MAX_PRODUCT_IMAGES = 10;
export const MAX_VARIATION_IMAGES = 5;
export const MAX_VARIATIONS = 30;
export const MAX_COLOR_LEN = 60;
export const MAX_STOCK = 99999;
export const MAX_EXTRA_PRICE = 1_000_000;
export const UPLOADED_IMAGE_PREFIX = "/api/product-images/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UPLOADED_RE = new RegExp(`^${UPLOADED_IMAGE_PREFIX}(${UUID})$`, "i");
const URL_RE = /^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/;

export interface VariationInput {
  name: string;
  stock: number;
  extraPrice: number;
  images: string[];
}
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** "/api/product-images/<uuid>" adresinden kimliği çıkarır; yüklenmiş görsel değilse null. */
export function uploadedImageId(url: string): string | null {
  return UPLOADED_RE.exec(url)?.[1].toLowerCase() ?? null;
}

/** Görsel listesi: yalnızca https:// veya site içi "/yol"; tekilleştirilir; üst sınır aşılırsa hata. */
export function parseImageUrls(raw: unknown, max: number, label: string): Parsed<string[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: `${label} listesi geçersiz.` };
  const urls: string[] = [];
  for (const u of raw) {
    if (typeof u !== "string") return { ok: false, error: `${label} listesi geçersiz.` };
    const s = u.trim();
    if (!s || s.length > 500 || !URL_RE.test(s)) return { ok: false, error: `${label}: geçersiz görsel adresi.` };
    if (!urls.includes(s)) urls.push(s);
  }
  if (urls.length > max) return { ok: false, error: `${label} en fazla ${max} olabilir.` };
  return { ok: true, value: urls };
}

/** Renk adı karşılaştırma anahtarı (trim + boşluk tekleştirme + Türkçe küçük harf). */
export const colorKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

function intIn(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Varyasyon listesi: en az 1 renk; ad boş olamaz, büyük/küçük harf duyarsız tekil; stok tam sayı 0-99999; fark 0-1.000.000; renk başına en fazla 5 görsel. */
export function parseVariations(raw: unknown): Parsed<VariationInput[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "En az bir renk girilmelidir." };
  if (raw.length > MAX_VARIATIONS) return { ok: false, error: `En fazla ${MAX_VARIATIONS} renk eklenebilir.` };
  const out: VariationInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown> | null;
    const n = i + 1;
    if (!r || typeof r !== "object") return { ok: false, error: `${n}. renk satırı geçersiz.` };
    const name = typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ") : "";
    if (!name) return { ok: false, error: `${n}. renk adı boş olamaz.` };
    if (name.length > MAX_COLOR_LEN) return { ok: false, error: `${n}. renk adı en fazla ${MAX_COLOR_LEN} karakter olabilir.` };
    const key = colorKey(name);
    if (seen.has(key)) return { ok: false, error: `"${name}" rengi birden fazla kez girilmiş.` };
    seen.add(key);
    const stock = intIn(r.stock, 0, MAX_STOCK);
    if (stock === null) return { ok: false, error: `"${name}" için stok 0 ile ${MAX_STOCK} arasında bir tam sayı olmalıdır.` };
    let extraPrice = 0;
    if (r.extraPrice !== undefined && r.extraPrice !== null && r.extraPrice !== "") {
      const e = typeof r.extraPrice === "number" ? r.extraPrice : Number(r.extraPrice);
      if (!Number.isFinite(e) || e < 0 || e > MAX_EXTRA_PRICE) return { ok: false, error: `"${name}" için fiyat farkı 0 ile ${MAX_EXTRA_PRICE.toLocaleString("tr-TR")} ₺ arasında olmalıdır.` };
      extraPrice = Math.round(e * 100) / 100;
    }
    const images = parseImageUrls(r.images, MAX_VARIATION_IMAGES, `"${name}" fotoğrafları`);
    if (!images.ok) return images;
    out.push({ name, stock, extraPrice, images: images.value });
  }
  return { ok: true, value: out };
}

/** Ürün ve renk görsellerinde geçen yüklenmiş görsel kimlikleri (tekil). */
export function uploadedIdsOf(...lists: string[][]): string[] {
  const ids = new Set<string>();
  for (const l of lists) for (const u of l) {
    const id = uploadedImageId(u);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Varsayılan seçim: ilk stoklu varyasyon (yoksa ilki). Ürün sayfası, kart, feed ve JsonLd aynı kuralı kullanır. */
export function pickDefaultVariation<V extends { stock: number }>(variations: V[]): V | null {
  return variations.find((v) => v.stock > 0) ?? variations[0] ?? null;
}

type ImgProduct = { imageUrl?: string | null; images?: string[] | null; variations: { images?: string[] | null }[] };
const clean = (l: (string | null | undefined)[]) => [...new Set(l.filter((u): u is string => typeof u === "string" && u.length > 0))];

/** Genel (ürün) fotoğrafları: images; boşsa eski kayıtlardaki imageUrl. Renk fotoğraflarından bağımsızdır. */
export function generalImagesOf(p: Pick<ImgProduct, "imageUrl" | "images">): string[] {
  const g = clean(p.images ?? []);
  return g.length > 0 ? g : clean([p.imageUrl]);
}

/** İlk fotoğrafı olan ilk rengin (sıra korunur) fotoğrafları; hiçbirinde yoksa []. */
function firstColorImages(variations: ImgProduct["variations"]): string[] {
  for (const v of variations) {
    const l = clean(v.images ?? []);
    if (l.length > 0) return l;
  }
  return [];
}

/**
 * TEK kapak kuralı (kart, liste, arama, favori, sepet, feed image_link, JSON-LD, og:image hep bunu kullanır):
 * kapak = genel fotoğrafların ilki; genel fotoğraf yoksa ilk rengin ilk fotoğrafı; ikisi de yoksa null.
 * Genel alandan yüklenen fotoğraf renk fotoğraflarını, renk fotoğrafı genel galeriyi ve kapağı değiştirmez.
 */
export function coverImageOf(p: ImgProduct): string | null {
  return generalImagesOf(p)[0] ?? firstColorImages(p.variations)[0] ?? null;
}

/** Feed / JSON-LD görsel listesi: kapak önde, sonra genel fotoğraflar, sonra renk fotoğrafları (tekil). */
export function imageListOf(p: ImgProduct): string[] {
  return clean([coverImageOf(p), ...generalImagesOf(p), ...p.variations.flatMap((v) => v.images ?? [])]);
}

/**
 * Ürün sayfası galerisi: renk SEÇİLMEDİYSE genel fotoğraflar (yoksa ilk rengin fotoğrafları); renk seçilince o rengin fotoğrafları,
 * rengin fotoğrafı yoksa genel galeri.
 */
export function galleryOf(p: ImgProduct, selected: { images?: string[] | null } | null, colorChosen: boolean): string[] {
  const color = clean(selected?.images ?? []);
  if (colorChosen && color.length > 0) return color;
  const general = generalImagesOf(p);
  return general.length > 0 ? general : firstColorImages(p.variations);
}

/** Ürünün (kapak + ürün + renk) tüm yüklenmiş görsel kimlikleri; silme geri alınırken satırlar yeniden bağlanır. */
export function productUploadIds(p: { images?: string[]; imageUrl?: string | null }, variations: { images?: string[] }[]): string[] {
  return uploadedIdsOf(p.images ?? [], p.imageUrl ? [p.imageUrl] : [], ...variations.map((v) => v.images ?? []));
}

/** Toplu renk eklemede yeni sıra: ürünün mevcut en büyük position değeri + 1 (varsayılan renk kaymasın). */
export function nextPosition(existing: { position: number }[]): number {
  return existing.reduce((m, e) => Math.max(m, e.position), -1) + 1;
}
