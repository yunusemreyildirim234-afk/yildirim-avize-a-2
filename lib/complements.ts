// Tamamlayıcı ürün ayarları ve doğrulama yardımcıları (saf). Sunucu doğrulaması, istemci girişi ve
// veritabanı CHECK kuralı (SiteConfig_complementSuggestCount_check: NULL veya 0-12) aynı sayıları kullanır.

import { bulkTiersOf, type BulkRule } from "./bulk-pricing.ts";
import { bestComplement, validComplementRule, type ComplementRule } from "./complement-pricing.ts";
import { pickDefaultOption } from "./default-variation.ts";
import { isPurchasablePrice } from "./purchasable.ts";
import { coverImageOf } from "./variation-input.ts";

export const DEFAULT_SUGGEST_COUNT = 4;
export const MAX_SUGGEST_COUNT = 12;
/** Bir ana ürüne en çok bağlanabilecek tamamlayıcı sayısı. */
export const MAX_COMPLEMENTS_PER_MAIN = MAX_SUGGEST_COUNT;

export const SUGGEST_COUNT_ERROR = `Öneri sayısı 0 ile ${MAX_SUGGEST_COUNT} arasında bir tam sayı olmalıdır (boş: ${DEFAULT_SUGGEST_COUNT}).`;

/** Yönetici girişi → saklanacak değer. Boş/null → null (varsayılan); geçersiz → hata mesajı. */
export function parseSuggestCount(input: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (input === null || input === undefined || (typeof input === "string" && input.trim() === "")) return { ok: true, value: null };
  const n = typeof input === "number" ? input : typeof input === "string" && /^\d+$/.test(input.trim()) ? Number(input.trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > MAX_SUGGEST_COUNT) return { ok: false, error: SUGGEST_COUNT_ERROR };
  return { ok: true, value: n };
}

/** Saklı değer → gösterilecek kart sayısı (NULL: 4, 0: kapalı). */
export function resolveSuggestCount(stored: number | null | undefined): number {
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 0) return DEFAULT_SUGGEST_COUNT;
  return Math.min(stored, MAX_SUGGEST_COUNT);
}

/** Bağ indirimi değeri doğrulaması (§4.3). Geçerliyse null, değilse Türkçe hata. */
export function validateComplementDiscount(type: unknown, value: unknown): string | null {
  if (type !== "PERCENT" && type !== "FIXED") return "İndirim türü yüzde veya TL olmalıdır.";
  if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0)) return "İndirim 0'dan büyük olmalıdır.";
  if (type === "PERCENT" && value >= 100) return "Yüzde 100'ün altında olmalıdır.";
  if (type === "FIXED" && Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return "TL indirimi en çok 2 ondalık içerebilir.";
  return null;
}

/** TL indirimi tamamlayıcının en düşük fiyatından küçük olmalı (aksi hâlde bağ kurulmaz). */
export function fixedDiscountFits(value: number, lowestPrice: number): boolean {
  return value < lowestPrice;
}

export interface SuggestCandidate {
  productId: string;
  active: boolean;
  purchasable: boolean; // fiyatı geçerli
  inStock: boolean; // en az bir varyasyonunda stok
  position: number;
  createdAt: number; // sıralama için (ms)
}

/** Öneri listesi: pasif/stoksuz/fiyatsız ve sepetteki ürünler elenir (sayıya girmez), position sonra eklenme sırası, ayar kadar kart. */
export function pickSuggestions<T extends SuggestCandidate>(cands: T[], cartProductIds: ReadonlySet<string>, stored: number | null | undefined): T[] {
  const limit = resolveSuggestCount(stored);
  if (limit === 0) return [];
  return cands
    .filter((c) => c.active && c.purchasable && c.inStock && !cartProductIds.has(c.productId))
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
    .slice(0, limit);
}

// ---- Öneri kartı verisi (saf): veritabanı satırı → istemciye giden küçük kayıt ----

export interface SuggestionVariation {
  id: string;
  variationType: string;
  variationValue: string;
  extraPrice: number;
  stock: number;
}

/** Öneri kartı (JSON'a uygun, yalnız gösterim ve sepete ekleme için gereken alanlar). */
export interface Suggestion {
  productId: string;
  title: string;
  imageUrl: string | null;
  basePrice: number;
  listPrice: number | null;
  bulk: BulkRule[];
  couponAllowed: boolean;
  pickupPct: number | null;
  transferPct: number | null;
  variations: SuggestionVariation[];
  rules: ComplementRule[]; // bu tamamlayıcıyı indirimli yapan (ana ürünü sepette/sayfada olan) bağlar
}

/** Veritabanından gelen bir bağ satırı (tamamlayıcı ürünüyle birlikte). */
export interface ComplementRow {
  mainProductId: string;
  discountType: string;
  discountValue: number;
  position: number;
  createdAt: Date | number;
  complement: {
    id: string;
    title: string;
    active: boolean;
    basePrice: number;
    listPrice: number | null;
    imageUrl: string | null;
    images: string[];
    bulkTiers: unknown;
    couponAllowed: boolean;
    pickupDiscountPct: number | null;
    transferDiscountPct: number | null;
    variations: (SuggestionVariation & { images?: string[] })[];
  };
}

/**
 * Bağ satırları → gösterilecek öneriler. Aynı tamamlayıcı birden çok ana ürüne bağlıysa tek kart (en küçük position, en eski bağ);
 * kurallar birleşir. Eleme ve sıra pickSuggestions'ta: aktif, fiyatı geçerli, en az bir varyasyonu stoklu; sepetteki ürünler gizlenir
 * ve sayıya girmez; sayı ayardan (NULL → 4, 0 → boş).
 */
export function buildSuggestions(rows: ComplementRow[], cartProductIds: ReadonlySet<string>, stored: number | null | undefined): Suggestion[] {
  const groups = new Map<string, { row: ComplementRow; position: number; createdAt: number; rules: ComplementRule[] }>();
  for (const r of rows) {
    const rule = { mainProductId: r.mainProductId, type: r.discountType, value: r.discountValue };
    if (!validComplementRule(rule)) continue;
    const at = typeof r.createdAt === "number" ? r.createdAt : r.createdAt.getTime();
    const g = groups.get(r.complement.id);
    if (!g) groups.set(r.complement.id, { row: r, position: r.position, createdAt: at, rules: [rule] });
    else {
      g.rules.push(rule);
      if (r.position < g.position || (r.position === g.position && at < g.createdAt)) {
        g.position = r.position;
        g.createdAt = at;
      }
    }
  }
  const cands = [...groups.values()].map((g) => {
    const p = g.row.complement;
    const def = pickDefaultOption(p.variations);
    return {
      productId: p.id,
      active: p.active,
      purchasable: def !== null && isPurchasablePrice(p.basePrice + def.extraPrice),
      inStock: p.variations.some((v) => v.stock > 0),
      position: g.position,
      createdAt: g.createdAt,
      g,
    };
  });
  return pickSuggestions(cands, cartProductIds, stored).map(({ g }) => {
    const p = g.row.complement;
    return {
      productId: p.id,
      title: p.title,
      imageUrl: coverImageOf({ imageUrl: p.imageUrl, images: p.images, variations: p.variations }),
      basePrice: p.basePrice,
      listPrice: p.listPrice && p.listPrice > p.basePrice ? p.listPrice : null,
      bulk: bulkTiersOf({ bulkTiers: p.bulkTiers }),
      couponAllowed: p.couponAllowed,
      pickupPct: p.pickupDiscountPct,
      transferPct: p.transferDiscountPct,
      variations: p.variations.map((v) => ({ id: v.id, variationType: v.variationType, variationValue: v.variationValue, extraPrice: v.extraPrice, stock: v.stock })),
      rules: g.rules,
    };
  });
}

/** Kart/sepet fiyatı: birlikte alma indirimi öncesi ve sonrası birim fiyat (kademe 1 adet için uygulanmaz). */
export function suggestionPrice(s: Pick<Suggestion, "basePrice" | "rules">, extraPrice: number): { regular: number; unit: number; discount: number } {
  const regular = s.basePrice + extraPrice;
  const pick = bestComplement(s.rules, new Set(s.rules.map((r) => r.mainProductId)), regular);
  const discount = pick?.unitDiscount ?? 0;
  return { regular, unit: Math.round((regular - discount) * 100) / 100, discount };
}

/** Karttaki varsayılan seçenek: stoklu en düşük ek fiyatlı (ürün sayfasıyla aynı kural). */
export function defaultSuggestionVariation(s: Pick<Suggestion, "variations">): SuggestionVariation | null {
  return pickDefaultOption(s.variations);
}

export const MAX_CART_PRODUCT_IDS = 50;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** `?ids=a,b,c` → tekil ürün kimlikleri. Biçim bozuksa veya en çok 50'yi aşarsa null (400). Boş → []. */
export function parseCartProductIds(raw: string | null): string[] | null {
  if (raw === null || raw.trim() === "") return [];
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => s !== ""))];
  if (ids.length > MAX_CART_PRODUCT_IDS || ids.some((id) => !ID_RE.test(id))) return null;
  return ids.sort(); // sıralı: aynı sepet aynı adres, önbellek tek kayıt
}

/** Sunucudan sıralı gelen önerilerden sepettekileri çıkarıp ayar kadarını gösterir (ürün sayfası: sepet yalnız istemcide bilinir). */
export function visibleSuggestions<T extends { productId: string }>(list: T[], cartProductIds: ReadonlySet<string>, stored: number | null | undefined): T[] {
  return list.filter((s) => !cartProductIds.has(s.productId)).slice(0, resolveSuggestCount(stored));
}
