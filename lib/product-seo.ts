import { FREE_SHIPPING_THRESHOLD, PICKUP_DISCOUNT, SHIPPING_COST } from "./pricing.ts";
import { validGtin } from "./feed.ts";
import { isAccessoryCategory } from "./bulb-note.ts";

/** <title> en çok ~57 karakter: düzendeki " | Yıldırım Avize" eki (17) düşülünce başlığa 40 karakter kalır. */
export const SEO_TITLE_MAX = 40;
export const META_DESCRIPTION_MAX = 160;
export const JSONLD_DESCRIPTION_MAX = 500;
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** Metni en çok `max` karaktere KELİME SINIRINDA keser (kelime ortasında bitmez); açık kalan parantez geri alınır, sondaki ayraçlar atılır. */
export function truncateAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  cut = sp > 0 ? cut.slice(0, sp) : cut.slice(0, max);
  const open = cut.lastIndexOf("(");
  if (open > cut.lastIndexOf(")")) cut = cut.slice(0, open);
  const trim = (x: string) => x.replace(/[\s,;:.\-–(]+$/u, "");
  cut = trim(cut);
  // Kesilen başlığın sonunda yalnız sayı ya da 2 karakter veya daha kısa kelime kalırsa atılır ("...Salon Avizesi 18" → "...Salon Avizesi")
  for (;;) {
    const i = cut.lastIndexOf(" ");
    if (i <= 0) break;
    const last = cut.slice(i + 1);
    if (!/^\d+$/.test(last) && last.length > 2) break;
    cut = trim(cut.slice(0, i));
  }
  return cut;
}

/** Sayfa <title> metni (ek düzenden gelir): temiz başlık, 40 karakteri aşarsa kelime sınırında kısaltılır. */
export const productSeoTitle = (cleanTitle: string) => truncateAtWord(cleanTitle, SEO_TITLE_MAX);

/** Meta açıklama: "{başlık}. {fiyat} ₺. Montajlı gönderilir; 350 TL üzeri kargo ücretsiz, Şişhane mağazadan teslimde %{oran} indirim." (≤160, başlık gerekirse kısaltılır). */
export function productMetaDescription(p: { cleanTitle: string; price: number; category?: string | null; pickupDiscountPct?: number | null }): string {
  const pickup = p.pickupDiscountPct ?? PICKUP_DISCOUNT * 100;
  const ship = `${FREE_SHIPPING_THRESHOLD} TL üzeri kargo ücretsiz`;
  const tail =
    ` ${fmt(p.price)} ₺. ` +
    (isAccessoryCategory(p.category) ? "" : "Montajlı gönderilir; ") +
    (pickup > 0 ? `${ship}, Şişhane mağazadan teslimde %${fmt(pickup)} indirim.` : `${ship}.`);
  const title = truncateAtWord(p.cleanTitle, META_DESCRIPTION_MAX - tail.length - 1);
  return `${title}.${tail}`.slice(0, META_DESCRIPTION_MAX);
}

/** JSON-LD Offer ek alanları: kargo (≥350 ücretsiz), 14 gün iade, +30 gün geçerlilik. */
export function offerExtras(o: { price: number; siteUrl: string; now?: Date }) {
  const until = new Date((o.now ?? new Date()).getTime() + 30 * 86400000).toISOString().slice(0, 10);
  return {
    priceValidUntil: until,
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
      shippingRate: { "@type": "MonetaryAmount", value: o.price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST, currency: "TRY" },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "TR",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      merchantReturnLink: `${o.siteUrl}/iptal-iade-cayma`,
    },
  };
}

/** Geçerli barkod (sağlama toplamı doğru) varsa gtin13 alanı; yalnız 13 haneli kodlar. */
export function gtin13Of(barcode: string | null | undefined): { gtin13: string } | Record<string, never> {
  const g = validGtin(barcode);
  return g && g.length === 13 ? { gtin13: g } : {};
}
