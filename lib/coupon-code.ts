// Promosyon kodu adı: doğrulama, vitrin metinleri ve yeniden adlandırma yardımcıları (saf; veritabanı/ortam yok, test edilebilir).
// Vitrin kuponunun adı kodda sabit yazılmaz; SiteConfig.showcaseCouponId ile kupon kaydına bağlanır (yoksa eski varsayılan kod).

/** SiteConfig.showcaseCouponId boşken (henüz bağlanmamış) vitrin kuponunu bulmak için eski varsayılan kod. */
export const LEGACY_SHOWCASE_CODE = "YILDIRIM5";

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;
export const COUPON_CODE_FORMAT_ERROR = "Kod 3-32 karakter olmalı (harf, rakam, - veya _).";

const TR_ASCII: Record<string, string> = { İ: "I", Ç: "C", Ğ: "G", Ö: "O", Ş: "S", Ü: "U" };

/** Kod yazımı: tr-TR büyük harf, boşluksuz, Türkçe harfler ASCII karşılığına ("yildirim5" = "YILDIRIM5"; "şeker10" = "SEKER10"). */
export function normalizeCouponCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\s+/g, "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[İÇĞÖŞÜ]/g, (c) => TR_ASCII[c]);
}

/** Normalize edilmiş kod biçimi geçerliyse null, değilse hata metni. */
export const couponCodeFormatError = (code: string): string | null => (COUPON_CODE_RE.test(code) ? null : COUPON_CODE_FORMAT_ERROR);

export const COUPON_CODE_TAKEN_ERROR = (code: string) => `"${code}" kodu başka bir promosyon kodunda kullanılıyor. Farklı bir ad seçin.`;

/** Vitrin kuponu mu: bağlı kimlik varsa yalnızca o; yoksa eski varsayılan kod. */
export const isShowcaseCoupon = (c: { id: string; code: string }, boundId: string | null | undefined): boolean =>
  boundId ? c.id === boundId : c.code.toUpperCase() === LEGACY_SHOWCASE_CODE;

// ---- Vitrin metinleri (kod adı vitrin kuponundan gelir) ----

/** Fiyat satırı: "XXX kuponuyla" */
export const ladderCouponLabel = (code: string) => `${code} kuponuyla`;

/** Ürün sayfası notu; vitrin kuponu yoksa kod adı geçmez. */
export const couponNotAllowedNote = (code: string | null | undefined) => (code ? `Bu üründe ${code} kuponu kullanılamamaktadır.` : "Bu üründe promosyon kodu kullanılamamaktadır.");

/** Sepet kutusu yer tutucusu */
export const couponPlaceholder = (code: string | null | undefined) => (code ? `Promosyon kodu (${code})` : "Promosyon kodu");

/** Kod yok/pasif/süresi dolmuş/yeniden adlandırılmış için tek genel hata (sızıntı önlemek için ayrım yapılmaz). */
export const COUPON_GENERIC_ERROR = "Geçersiz veya süresi dolmuş kupon kodu.";

/** Sepette saklanan kod artık geçerli değilse (silindi/yeniden adlandırıldı/pasif) gösterilen net mesaj. */
export const staleCouponMessage = (code: string) => `"${code}" kodu artık geçerli değil; sepetinizden kaldırıldı. Güncel kodu girebilir veya kuponsuz devam edebilirsiniz.`;

/** ruleNotes çıktısındaki sabit eski kodu (cart-pricing.ts dokunulmaz) güncel vitrin koduyla değiştirir. */
export function withShowcaseNote(notes: string[], code: string | null | undefined): string[] {
  const fixed = couponNotAllowedNote(LEGACY_SHOWCASE_CODE);
  return notes.map((n) => (n === fixed ? couponNotAllowedNote(code) : n));
}

// ---- Ana sayfa avantaj kartları ----

type CodeCard = { kind: string; code?: string };

/** Varsayılan (kayıtsız) kupon kartının kodu vitrin kuponunun güncel adıyla gösterilir. */
export function defaultCardsWithCode<T extends CodeCard>(cards: T[], code: string | null | undefined): T[] {
  if (!code) return cards;
  return cards.map((c) => (c.kind === "COUPON" && c.code?.toUpperCase() === LEGACY_SHOWCASE_CODE ? { ...c, code } : c));
}

/** homepageConfig.promoCards içindeki kupon kartlarının kodunu eski → yeni değiştirir. Değişiklik yoksa null. */
export function renamePromoCardCodes(config: unknown, oldCode: string, newCode: string): Record<string, unknown> | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const obj = config as Record<string, unknown>;
  if (!Array.isArray(obj.promoCards)) return null;
  let changed = false;
  const promoCards = obj.promoCards.map((c) => {
    if (c && typeof c === "object" && (c as CodeCard).kind === "COUPON" && typeof (c as CodeCard).code === "string" && (c as CodeCard).code!.toUpperCase() === oldCode.toUpperCase()) {
      changed = true;
      return { ...(c as object), code: newCode };
    }
    return c;
  });
  return changed ? { ...obj, promoCards } : null;
}
