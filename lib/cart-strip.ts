// Sepet sayfası "Sepetinize uygun diğer ürünler" şeridi için SAF mantık (veritabanı ve Next yok; test edilebilir).
// Sepetin kategorilerinden karışık bir kimlik listesi kurar; sepetteki ürünler listede KALIR (pencereler listeye hizalı, kart önbelleği anahtarı
// yalnız kategori kümesine bağlıdır) ve sayfalanırken bellekte atılır (lib/similar-strip.ts collectPage).
import { similarList, type SimilarRow } from "./similar-strip.ts";

export const CART_STRIP_MAX_CATEGORIES = 5;

/**
 * Sepetteki ürün kimliklerinden kategoriler: sepet sırasına göre, tekrarsız, en çok 5. Katalogda bulunmayan ya da kategorisi boş ürün atlanır.
 * Dönüş kategori adına göre SIRALANIR: aynı kategori kümesi sepet sırası/içeriği ne olursa olsun aynı listeyi (aynı önbellek anahtarını) üretir.
 */
export function cartCategories(rows: SimilarRow[], productIds: string[]): string[] {
  const catOf = new Map(rows.map((r) => [r.id, r.rc]));
  const picked: string[] = [];
  for (const id of productIds) {
    const c = catOf.get(id);
    if (typeof c !== "string" || !c.trim() || picked.includes(c)) continue;
    picked.push(c);
    if (picked.length >= CART_STRIP_MAX_CATEGORIES) break;
  }
  return picked.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Her kategorinin (aktif, stoklu, kararlı sıralı) listesi sırayla birer birer dönüşümlü karıştırılır; kimlikler tekrarsızdır. */
export function mixedList(rows: SimilarRow[], categories: string[]): string[] {
  const lists = categories.map((c) => similarList(rows, c));
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      if (i < l.length && !seen.has(l[i])) {
        seen.add(l[i]);
        out.push(l[i]);
      }
    }
  }
  return out;
}

/** Sepetteki kimliklerden (tekrarsız) karışık şerit listesi; kategori yoksa boş liste (şerit gösterilmez). */
export function cartStripList(rows: SimilarRow[], productIds: string[]): string[] {
  return mixedList(rows, cartCategories(rows, productIds));
}
