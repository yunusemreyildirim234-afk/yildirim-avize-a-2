// Tahmini KDV (saf). Site fiyatları ve Kargonomi kargo ücreti KDV DAHİLDİR. Tutarlar kuruş tamsayısıdır; yuvarlama aylık toplamlar üzerinde yapılır.
export const VAT_RATE = 0.2;

/** KDV dahil tutar içindeki KDV (kuruş). */
export const vatIncluded = (grossKurus: number, rate = VAT_RATE) => Math.round((grossKurus * rate) / (1 + rate));
/** KDV dahil tutarın KDV hariç karşılığı (kuruş). */
export const excludingVat = (grossKurus: number, rate = VAT_RATE) => Math.round(grossKurus / (1 + rate));
