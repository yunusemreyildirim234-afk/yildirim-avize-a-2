// Hızlı ürün girişi: renk/varyasyon ve fotoğraf girdisi için SAF sunucu doğrulaması (içe aktarma yok; istemciye güvenilmez).
import { MAX_PRICE } from "./price-input.ts";
import { parseSize,secenekColorName, titleTr, variationAttrs, type VariationAttrs } from "./listing-core.ts";

export const MAX_PRODUCT_IMAGES = 10;
/** Renk (varyasyon) başına fotoğraf üst sınırı: arayüz, sunucu doğrulaması ve yüklemeler bu tek sabiti kullanır (sınırsız değil: Blob kotası ve istek boyutu). */
export const MAX_VARIATION_IMAGES = 30;
/** Düzenleme / geri alma sırasında bir üründeki toplam genel görsel üst sınırı (Trendyol ürünlerinde 20'yi aşabilir). */
export const MAX_EDIT_IMAGES = 30;
export const MAX_VARIATIONS = 30;
export const MAX_COLOR_LEN = 60;
export const MAX_STOCK = 99999;
export const MAX_EXTRA_PRICE = MAX_PRICE;
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

/** Varyasyon listesi: en az 1 renk; ad boş olamaz, büyük/küçük harf duyarsız tekil; stok tam sayı 0-99999; fark 0-1.000.000; renk başına en fazla MAX_VARIATION_IMAGES görsel. */
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

/** İlk stoklu varyasyon (yoksa ilki); fiyatı dikkate almaz. Üretimde kullanılmaz; fiyatı belirleyen varsayılan seçenek için lib/default-variation.ts pickDefaultOption kullanılır. */
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

/** Renk sırası isteği geçerli mi? order, ürünün TÜM renk kimliklerinin (tekil) bir permütasyonu olmalı. */
export function isCompleteOrder(order: unknown, existingIds: string[]): order is string[] {
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) return false;
  if (new Set(order).size !== order.length || order.length !== existingIds.length) return false;
  const have = new Set(existingIds);
  return order.every((id) => have.has(id));
}

// ---------- Varyasyon adı düzenleme / toplu renk değiştirme (SAF; istemci önizlemesi ve sunucu doğrulaması aynı kodu kullanır) ----------

export interface NamePlan {
  /** Kaydedilecek normalize ad: "Renk" ya da "Renk / 45 x 25" */
  value: string;
  /** Filtrenin bu adı nasıl okuyacağı (listing-core ile aynı kural) */
  attrs: VariationAttrs;
  /** Boş değilse kaydetmek için açık onay gerekir (renk filtresinde görünmeyebilir) */
  warnings: string[];
}

const foldTr = (s: string) => s.replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
const SLASH = /\s*\/\s*/;
const SIZE_IN_COLOR = /\d\s*[xX×]\s*\d/;

/** Ad karşılaştırma anahtarı: büyük/küçük harf ve Türkçe harf farkı gözetmez; ebat varsa "45x25" ile "45 x 25" aynıdır. */
export function nameKey(value: string): string {
  const [head, ...rest] = value.trim().replace(/\s+/g, " ").split(SLASH);
  const tail = rest.map((p) => parseSize(p)?.n ?? p);
  return foldTr([head, ...tail].join(" / ").toLocaleLowerCase("tr"));
}

/** "Renk" ya da "Renk / Ebat" → normalize ad. Hata: Türkçe mesaj. */
function parseName(raw: unknown): Parsed<{ color: string; ebat: string | null }> {
  if (typeof raw !== "string") return { ok: false, error: "Ad boş olamaz." };
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, error: "Ad boş olamaz." };
  if (text.length > MAX_COLOR_LEN) return { ok: false, error: `Ad en fazla ${MAX_COLOR_LEN} karakter olabilir.` };
  const parts = text.split(SLASH);
  const fmt = "Ad \"Renk\" ya da \"Renk / Ebat\" biçiminde olmalıdır (örn. Krom / 58 x 58).";
  if (parts.length > 2 || parts.some((p) => !p)) return { ok: false, error: `Biçim tanınmıyor. ${fmt}` };
  const [colorRaw, ebatRaw] = parts;
  if (parseSize(colorRaw) || SIZE_IN_COLOR.test(colorRaw)) return { ok: false, error: `Biçim tanınmıyor: renk önce, ebat sonra gelmeli ve aralarında " / " olmalı. ${fmt}` };
  let ebat: string | null = null;
  if (ebatRaw !== undefined) {
    const s = parseSize(ebatRaw);
    if (!s) return { ok: false, error: `Ebat geçerli değil: "${ebatRaw}". Ebat "en x boy" olmalı (örn. 58 x 58); birim (cm) yazmayın.` };
    ebat = s.n;
  }
  const color = titleTr(colorRaw.toLocaleLowerCase("tr-TR"));
  const value = ebat ? `${color} / ${ebat}` : color;
  if (value.length > MAX_COLOR_LEN) return { ok: false, error: `Ad en fazla ${MAX_COLOR_LEN} karakter olabilir.` };
  return { ok: true, value: { color, ebat } };
}

const colorWarning = (color: string) => (secenekColorName(color) ? [] : [`"${color}" renk izin listesinde yok; renk filtresinde görünmeyebilir.`]);
const warningsOf = (color: string, ebat: string | null, productEbat: string | null | undefined): string[] => [
  ...colorWarning(color),
  ...(!ebat && !productEbat ? ["Ad ebat içermiyor (ürünün ebadı da boş); ebat filtresinde görünmeyebilir."] : []),
];

/** Tek varyasyonun adı. others: AYNI ürünün diğer varyasyonlarının adları (kendisi hariç). */
export function planRename(raw: unknown, ctx: { type: string; current: string; others: readonly string[]; productEbat?: string | null }): Parsed<NamePlan> {
  const p = parseName(raw);
  if (!p.ok) return p;
  const value = p.value.ebat ? `${p.value.color} / ${p.value.ebat}` : p.value.color;
  if (value === ctx.current) return { ok: false, error: "Ad değişmedi." };
  const key = nameKey(value);
  const clash = ctx.others.find((o) => nameKey(o) === key);
  if (clash !== undefined) return { ok: false, error: `Bu üründe "${clash}" adlı bir varyasyon zaten var.` };
  return { ok: true, value: { value, attrs: variationAttrs(ctx.type, value), warnings: warningsOf(p.value.color, p.value.ebat, ctx.productEbat) } };
}

export interface BulkVariation {
  id: string;
  type: string;
  value: string;
}
export interface BulkChange {
  id: string;
  from: string;
  to: string;
  attrs: VariationAttrs;
}
export interface BulkPlan {
  newColor: string;
  changes: BulkChange[];
  warnings: string[];
}

const headOf = (value: string) => value.split(SLASH)[0].trim();
const headKey = (value: string) => foldTr(headOf(value).replace(/\s+/g, " ").toLocaleLowerCase("tr"));

/** Ürünün varyasyonlarındaki benzersiz renk (ilk parça) listesi; aynı renk büyük/küçük harf farkıyla bir kez gelir. */
export function distinctColors(variations: readonly { value: string }[]): string[] {
  const seen = new Map<string, string>();
  for (const v of variations) {
    const h = headOf(v.value);
    if (h && !seen.has(headKey(v.value))) seen.set(headKey(v.value), h);
  }
  return [...seen.values()];
}

/** Ürünün tüm varyasyonlarında yalnızca eski rengin parçasını yenisiyle değiştirir; " / " sonrası olduğu gibi kalır. */
export function planBulkColor(variations: readonly BulkVariation[], oldColor: unknown, newColor: unknown): Parsed<BulkPlan> {
  if (typeof oldColor !== "string" || !oldColor.trim()) return { ok: false, error: "Eski rengi seçin." };
  const oldKey = foldTr(oldColor.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr"));
  const hits = variations.filter((v) => headKey(v.value) === oldKey);
  if (hits.length === 0) return { ok: false, error: `"${oldColor.trim()}" rengi bu üründe bulunamadı.` };
  if (typeof newColor !== "string" || !newColor.trim()) return { ok: false, error: "Yeni renk boş olamaz." };
  const nc = newColor.trim().replace(/\s+/g, " ");
  if (nc.includes("/")) return { ok: false, error: "Yeni renkte \"/\" kullanmayın; ebat olduğu gibi korunur." };
  const parsed = parseName(nc);
  if (!parsed.ok) return parsed;
  const color = parsed.value.color;

  const changes: BulkChange[] = [];
  const next = new Map<string, string>();
  for (const v of variations) {
    if (headKey(v.value) !== oldKey) {
      next.set(v.id, v.value);
      continue;
    }
    const i = v.value.indexOf("/");
    const to = i < 0 ? color : `${color} / ${v.value.slice(i + 1).trim()}`;
    if (to.length > MAX_COLOR_LEN) return { ok: false, error: `"${to}" adı ${MAX_COLOR_LEN} karakteri aşıyor.` };
    next.set(v.id, to);
    if (to !== v.value) changes.push({ id: v.id, from: v.value, to, attrs: variationAttrs(v.type, to) });
  }
  if (changes.length === 0) return { ok: false, error: "Değişecek varyasyon yok." };
  const changed = new Set(changes.map((c) => c.id));
  const byKey = new Map<string, { id: string; name: string }>();
  for (const v of variations) {
    const name = next.get(v.id)!;
    const k = nameKey(name);
    const other = byKey.get(k);
    if (other && (changed.has(v.id) || changed.has(other.id))) return { ok: false, error: `Çakışma: "${other.name}" ve "${name}" aynı ad olur.` };
    byKey.set(k, { id: v.id, name });
  }
  return { ok: true, value: { newColor: color, changes, warnings: colorWarning(color) } };
}
