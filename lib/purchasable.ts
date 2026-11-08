// Satın alınabilirlik: sunucuda hesaplanan birim fiyat (basePrice + extraPrice) 0 veya altındaysa kalem satılamaz.
// (İndirim SONRASI toplamın 0 olması ayrı bir kuraldır; burada yalnızca liste birim fiyatı denetlenir.) Saf, bağımlılıksız.

export const isPurchasablePrice = (unitPrice: number) => Number.isFinite(unitPrice) && unitPrice > 0;

export const priceUnavailableMessage = (title: string) => `"${title}" için güncel fiyat bilgisi yok, bu ürün şu an sepete eklenemez. Fiyat için bize WhatsApp'tan yazabilirsiniz.`;
