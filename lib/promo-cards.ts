// Ana sayfa "Avantajlar" kartları: doğrulama, varsayılanlar ve görünürlük kuralları (saf fonksiyonlar; veritabanı/ortam yok).
// Kartlar SiteConfig.homepageConfig.promoCards içinde saklanır; alan yoksa/bozuksa varsayılan 3 kart kullanılır.

export const PROMO_KINDS = ["COUPON", "TEXT", "SHIPPING", "PICKUP"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/** Marka logosundaki renk ailesi (kırmızı, turuncu, sarı, yeşil, mavi, mor). Sınıflar components/PromoStrip.tsx içinde. */
export const PROMO_THEMES = ["kirmizi", "turuncu", "sari", "yesil", "mavi", "mor"] as const;
export type PromoTheme = (typeof PROMO_THEMES)[number];

export const MAX_PROMO_CARDS = 6;
export const MAX_TITLE = 60;
export const MAX_TEXT = 160;
export const MAX_CODE = 30;
export const MAX_HREF = 200;

export interface PromoCard {
  id: string;
  kind: PromoKind;
  title: string; // SHIPPING/PICKUP/COUPON için boşsa otomatik metin
  text: string;
  code?: string; // yalnızca COUPON
  theme: PromoTheme;
  href?: string; // site içi yol veya https
  active: boolean;
}

export const DEFAULT_PROMO_CARDS: PromoCard[] = [
  { id: "kupon", kind: "COUPON", title: "", text: "", code: "YILDIRIM5", theme: "turuncu", active: true },
  { id: "kargo", kind: "SHIPPING", title: "", text: "", theme: "yesil", active: true },
  { id: "magaza", kind: "PICKUP", title: "", text: "", theme: "kirmizi", active: true },
];

const ALLOWED_KEYS = ["id", "kind", "title", "text", "code", "theme", "href", "active"];
const CONTROL = /[\u0000-\u001f\u007f]/;

function cleanText(v: unknown, max: number, label: string): { ok: true; value: string } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: "" };
  if (typeof v !== "string") return { ok: false, error: `${label} metin olmalıdır.` };
  const t = v.trim();
  if (CONTROL.test(t)) return { ok: false, error: `${label} geçersiz karakter içeriyor.` };
  if (t.length > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir.` };
  return { ok: true, value: t };
}

/** Yalnızca site içi yol ("/..." ama "//" değil) veya https adresi. */
export function validHref(h: string): boolean {
  if (h.length === 0 || h.length > MAX_HREF || CONTROL.test(h) || /\s/.test(h) || h.includes("\\")) return false;
  if (h.startsWith("/")) return !h.startsWith("//");
  try {
    const u = new URL(h);
    return u.protocol === "https:" && u.hostname.length > 0 && !u.username && !u.password;
  } catch {
    return false;
  }
}

export type PromoValidation = { ok: true; cards: PromoCard[] } | { ok: false; error: string };

/** Sunucu doğrulaması: tür/uzunluk/sayı sıkı; bilinmeyen alan reddedilir. Geçerli kartlar normalleştirilmiş döner. */
export function validatePromoCards(raw: unknown): PromoValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "Kartlar bir liste olmalıdır." };
  if (raw.length > MAX_PROMO_CARDS) return { ok: false, error: `En fazla ${MAX_PROMO_CARDS} kart eklenebilir.` };
  const cards: PromoCard[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const n = i + 1;
    if (!c || typeof c !== "object" || Array.isArray(c)) return { ok: false, error: `${n}. kart geçersiz.` };
    const o = c as Record<string, unknown>;
    const extra = Object.keys(o).find((k) => !ALLOWED_KEYS.includes(k));
    if (extra) return { ok: false, error: `${n}. kartta bilinmeyen alan: ${extra}` };
    if (typeof o.kind !== "string" || !(PROMO_KINDS as readonly string[]).includes(o.kind)) return { ok: false, error: `${n}. kartın türü geçersiz.` };
    const kind = o.kind as PromoKind;
    if (typeof o.theme !== "string" || !(PROMO_THEMES as readonly string[]).includes(o.theme)) return { ok: false, error: `${n}. kartın renk teması geçersiz.` };
    if (typeof o.active !== "boolean") return { ok: false, error: `${n}. kartın etkin/pasif durumu geçersiz.` };

    const title = cleanText(o.title, MAX_TITLE, `${n}. kart başlığı`);
    if (!title.ok) return { ok: false, error: title.error };
    const text = cleanText(o.text, MAX_TEXT, `${n}. kart metni`);
    if (!text.ok) return { ok: false, error: text.error };
    if (kind === "TEXT" && !title.value) return { ok: false, error: `${n}. kart (serbest metin) için başlık zorunludur.` };

    let code: string | undefined;
    if (kind === "COUPON") {
      const rawCode = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
      if (!/^[A-Z0-9_-]+$/.test(rawCode) || rawCode.length > MAX_CODE) return { ok: false, error: `${n}. kartın kupon kodu geçersiz (büyük harf, rakam, - ve _; en fazla ${MAX_CODE}).` };
      code = rawCode;
    } else if (o.code !== undefined && o.code !== null && o.code !== "") {
      return { ok: false, error: `${n}. kart kupon türünde olmadığı için kupon kodu içeremez.` };
    }

    let href: string | undefined;
    if (o.href !== undefined && o.href !== null && o.href !== "") {
      if (typeof o.href !== "string" || !validHref(o.href.trim())) return { ok: false, error: `${n}. kartın bağlantısı yalnızca site içi yol (/...) veya https olabilir.` };
      href = o.href.trim();
    }

    let id = typeof o.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(o.id) ? o.id : `k${n}`;
    if (ids.has(id)) id = `k${n}-${i}`;
    ids.add(id);
    cards.push({ id, kind, title: title.value, text: text.value, ...(code ? { code } : {}), theme: o.theme as PromoTheme, ...(href ? { href } : {}), active: o.active });
  }
  return { ok: true, cards };
}

/**
 * homepageConfig JSON'undan kartlar. promoCards yoksa veya geçersizse varsayılan 3 kart (geriye uyumluluk);
 * kayıtlı ama boş liste "kart yok" demektir.
 */
export function resolvePromoCards(homepageConfig: unknown): PromoCard[] {
  const obj = homepageConfig && typeof homepageConfig === "object" && !Array.isArray(homepageConfig) ? (homepageConfig as Record<string, unknown>) : null;
  if (!obj || !("promoCards" in obj)) return DEFAULT_PROMO_CARDS;
  const v = validatePromoCards(obj.promoCards);
  return v.ok ? v.cards : DEFAULT_PROMO_CARDS;
}

export interface CouponRow {
  code: string;
  active: boolean;
  expiresAt: Date | string | null;
  usedCount: number;
  maxUses: number;
  userEmail: string | null;
  discountType: string;
  discountPercent: number;
  discountAmount: number | null;
  productId?: string | null; // doluysa kupon yalnızca o üründe geçer (ana sayfa kartında genel kupon gibi gösterilmez)
}

/** Herkese açık kart için kupon kullanılabilir mi: aktif + süresi geçmemiş + limiti dolmamış + kişiye özel değil + ürüne özel değil. */
export function couponUsable(c: CouponRow | undefined | null, now: Date = new Date()): boolean {
  if (!c || !c.active || c.userEmail || c.productId) return false;
  if (c.expiresAt && now.getTime() > new Date(c.expiresAt).getTime()) return false;
  return c.usedCount < c.maxUses;
}

/** "%5" veya "100 ₺" */
export function couponLabel(c: Pick<CouponRow, "discountType" | "discountPercent" | "discountAmount">): string {
  return c.discountType === "FIXED" && c.discountAmount
    ? `${c.discountAmount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`
    : `%${c.discountPercent.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

export interface PromoContext {
  coupons: Record<string, CouponRow | undefined>; // kart kodlarına karşılık gelen kayıtlar (büyük harf anahtar)
  maxTotalDiscountPct: number | null; // 0: "ek indirim yok"
  freeShippingThreshold: number;
  pickupPct: number; // örn. 3
  mapLink: string;
  now?: Date;
}

export interface PromoView {
  id: string;
  kind: PromoKind;
  title: string;
  text: string;
  code?: string;
  theme: PromoTheme;
  href?: string;
  cta?: { label: string; href: string; external: boolean };
}

const tl = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;

/**
 * Görünür kartlar ve gösterim modelleri. Kurallar:
 * - pasif kart gizli; COUPON kartı kupon geçerli değilse (süresi geçmiş/limiti dolu/pasif/yok) gizli;
 * - toplam indirim üst sınırı 0 ise indirim vaat eden kartlar (COUPON, PICKUP) gizli; SHIPPING ve TEXT her zaman gösterilir;
 * - hiç kart kalmazsa boş liste (bölüm render edilmez).
 */
export function buildPromoViews(cards: PromoCard[], ctx: PromoContext): PromoView[] {
  const capZero = ctx.maxTotalDiscountPct === 0;
  const out: PromoView[] = [];
  for (const c of cards) {
    if (!c.active) continue;
    const base = { id: c.id, kind: c.kind, theme: c.theme, ...(c.href ? { href: c.href } : {}) };
    if (c.kind === "COUPON") {
      const row = c.code ? ctx.coupons[c.code.toUpperCase()] : undefined;
      if (capZero || !couponUsable(row, ctx.now)) continue;
      out.push({ ...base, title: c.title || "İndirim Kodu", text: c.text || `Sepetinizde ${couponLabel(row!)} indirim için kodu kullanın.`, code: c.code });
    } else if (c.kind === "PICKUP") {
      if (capZero) continue;
      out.push({ ...base, title: c.title || "Mağazadan Teslim", text: c.text || `Şişhane merkezimizden teslimde anında %${ctx.pickupPct.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} indirim.`, cta: { label: "Yol Tarifi Al", href: ctx.mapLink, external: true } });
    } else if (c.kind === "SHIPPING") {
      out.push({ ...base, title: c.title || "Ücretsiz Kargo", text: c.text || `${tl(ctx.freeShippingThreshold)} ve üzeri siparişlerde kargo ücretsiz.` });
    } else {
      out.push({ ...base, title: c.title, text: c.text });
    }
  }
  return out;
}

/** Kartlardaki kupon kodları (büyük harf, tekrarsız): tek sorguyla okunur. */
export const couponCodesOf = (cards: PromoCard[]) => [...new Set(cards.filter((c) => c.kind === "COUPON" && c.code).map((c) => c.code!.toUpperCase()))];

/** Admin kaydında uyarı: etkin kupon kartı geçerli olmayan bir koda işaret ediyorsa. Kaydı engellemez. */
export function couponWarnings(cards: PromoCard[], coupons: Record<string, CouponRow | undefined>, now: Date = new Date()): string[] {
  return cards
    .filter((c) => c.kind === "COUPON" && c.code)
    .filter((c) => !couponUsable(coupons[c.code!.toUpperCase()], now))
    .map((c) => `"${c.code}" kuponu şu an geçerli değil (bulunamadı, pasif, süresi geçmiş, limiti dolmuş veya kişiye özel); kart ana sayfada gizli kalır.`);
}
