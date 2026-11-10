import { normalizeSearch } from "./search-rank.ts";

export type BulbNote = "gift" | "not-included" | "none";

/** Ürün/sepet satırında hangi ampul notu gösterilir? "gift": başlıkta "ampul(ler) hediye"; "none": Aksesuar kategorisi; aksi "not-included". */
export function bulbNoteFor(title: string, category?: string | null): BulbNote {
  if (category && normalizeSearch(category) === "aksesuar") return "none";
  return /\bampul(ler)? hediye\b/.test(normalizeSearch(title)) ? "gift" : "not-included";
}
