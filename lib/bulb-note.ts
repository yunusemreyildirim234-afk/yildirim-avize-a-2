import { normalizeSearch } from "./search-rank.ts";

export type BulbNote = "gift" | "not-included" | "none";

/** Ürün/sepet satırında hangi ampul notu gösterilir? "gift": başlıkta "ampul(ler) hediye"; "none": Aksesuar kategorisi; aksi "not-included". */
export function bulbNoteFor(title: string, category?: string | null): BulbNote {
  if (isAccessoryCategory(category)) return "none";
  return /\bampul(ler)? hediye\b/.test(normalizeSearch(title)) ? "gift" : "not-included";
}

/** Aksesuar kategorisi mi? (avize taşı, plaket vb.: ampul notu, "Ölçü & Tavan Uyumu" kutusu ve "Benzer Avize Modelleri" başlığı gösterilmez) */
export function isAccessoryCategory(category?: string | null): boolean {
  return Boolean(category) && normalizeSearch(category as string) === "aksesuar";
}
