// Gösterim: fiyatı 0/boş/≤0 ürünlerde fiyat yerine kısa metin. Saf, bağımlılıksız.
// (Satın alınabilirlik denetimi sunucuda lib/purchasable.ts ile ayrıca yapılır.)

export const hasPrice = (price: number | null | undefined): price is number =>
  typeof price === "number" && Number.isFinite(price) && price > 0;

export const PRICE_CONTACT_TEXT = "Fiyat için bize ulaşın";
export const PRICE_CONTACT_HREF = "/iletisim";
export const NO_PRICE_CART_REASON = "Fiyat bilgisi olmadığı için bu ürün şu an sepete eklenemez.";
