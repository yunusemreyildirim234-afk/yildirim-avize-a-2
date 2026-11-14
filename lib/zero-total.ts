// Sepet toplamı indirimlerden sonra 0 TL veya altına inerse sipariş açılmaz (sipariş ucu ve fiyat teklifi aynı kuralı/metni kullanır). Saf.

export const ZERO_TOTAL_ERROR = "Kupon tutarı sepet toplamının tamamını karşılıyor; ödenecek tutar 0 ₺ olamaz. Lütfen kuponu kaldırın veya sepete ürün ekleyin.";

export const isZeroTotal = (total: number) => !(total > 0);
