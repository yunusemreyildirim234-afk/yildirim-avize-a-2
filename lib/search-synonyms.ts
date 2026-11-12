// Küçük eş anlamlı sözlüğü (SAF; veritabanı yok). YALNIZCA 0 sonuçta ve düzeltme olarak kullanılır: var olan sonuçları asla değiştirmez.
// Genişletmek için SYNONYMS'e satır ekleyin. Sol: sorguda geçen ifade, sağ: katalogda KARŞILIĞI olan kelime. Her iki taraf da normalize yazılır
// (küçük harf, ASCII: lüster → "luster"; çok kelimeli olabilir). Katalogda karşılığı olmayan eşleme eklemeyin (kategoriler: Kristal, Modern, Klasik, Sarkıt, Aksesuar).
import { normalizeSearch } from "./search-rank.ts";

export const SYNONYMS: readonly (readonly [from: string, to: string])[] = [
  ["luster", "avize"],
  ["chandelier", "avize"],
  ["crystal", "kristal"],
  ["duvar lambasi", "aplik"],
  ["duvar lambalari", "aplik"],
  ["yedek parca", "aksesuar"], // kategori adı "Aksesuar & Yedek Parça"
];

const NORMALIZED = SYNONYMS.map(([f, t]) => [normalizeSearch(f), normalizeSearch(t)] as const);

/** Sorgudaki eş anlamlı ifadeleri (kelime sınırında) karşılığıyla değiştirir; değişiklik yoksa null. */
export function applySynonyms(q: string): string | null {
  let text = ` ${normalizeSearch(q)} `;
  if (text.trim() === "") return null;
  let changed = false;
  for (const [from, to] of NORMALIZED) {
    const needle = ` ${from} `;
    if (text.includes(needle)) {
      text = text.split(needle).join(` ${to} `);
      changed = true;
    }
  }
  return changed ? text.trim().replace(/\s+/g, " ") : null;
}
