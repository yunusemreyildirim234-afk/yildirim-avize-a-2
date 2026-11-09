/** Arama sorgusu en çok bu kadar karakter (API ve /arama sayfası aynı sınırı kullanır). */
export const MAX_SEARCH_LEN = 80;
/** /arama sayfasında listelenebilecek en çok ürün (sayfalama bu tavana kadar). */
export const MAX_SEARCH_RESULTS = 500;

/** Ham sorguyu sınırlar (boşluklar kırpılmadan döner; boşluk kontrolü çağıranda). */
export const clipQuery = (raw: string | null | undefined) => (raw || "").slice(0, MAX_SEARCH_LEN);
