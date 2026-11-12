// Arama yazım toleransı için SAF çekirdek (veritabanı ve Next bağımlılığı yok; birim test edilebilir).
// Sözlük, zaten önbellekli katalog satırlarından (başlık, kategori, renk adı) türetilir: veritabanına ek okuma yoktur.
import { normalizeSearch } from "./search-rank.ts";

export interface VocabRow {
  title?: string;
  /** Ham kategori yazımı */
  rc?: string;
  /** Varyasyon renkleri (yalnızca ad kullanılır) */
  vars?: readonly { c: { n: string } | null }[];
}

export interface Vocabulary {
  /** normalize kelime → kelimeyi içeren ürün sayısı */
  counts: Map<string, number>;
  /** normalize kelime → katalogda en sık geçen özgün (tr-TR küçük harf) yazım */
  display: Map<string, string>;
}

/** En fazla bu kadar kelime düzeltilir (kötüye kullanım ve maliyet sınırı). */
export const MAX_QUERY_WORDS = 6;
const MIN_WORD_LEN = 4;

/** Komşu harf yer değişimi 1 sayılır (OSA). `max` aşılırsa erken çıkar ve max + 1 döner. */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < min) min = v;
    }
    if (min > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] > max ? max + 1 : prev[b.length];
}

/** Düzeltme sözlüğü: başlık + kategori + renk adı kelimeleri. Rakam içeren ve 4 harften kısa kelimeler (kod/ölçü) alınmaz. */
export function buildVocabulary(rows: readonly VocabRow[]): Vocabulary {
  const counts = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const texts = [r.title, r.rc, ...(r.vars ?? []).map((v) => v.c?.n)];
    const seen = new Set<string>();
    for (const text of texts) {
      if (!text) continue;
      for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
        const n = normalizeSearch(raw);
        if (n.length < MIN_WORD_LEN || /\d/.test(n) || n.includes(" ")) continue;
        const shown = raw.toLocaleLowerCase("tr-TR");
        const sp = spellings.get(n) ?? new Map<string, number>();
        sp.set(shown, (sp.get(shown) ?? 0) + 1);
        spellings.set(n, sp);
        if (!seen.has(n)) {
          seen.add(n);
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      }
    }
  }
  const display = new Map<string, string>();
  for (const [n, sp] of spellings) display.set(n, [...sp].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))[0][0]);
  return { counts, display };
}

/** Mesafe eşiği: kelime uzadıkça güvenle artar (4-7 harf: 1, 8-11: 2, 12+: 3). 4 harften kısa kelime düzeltilmez. */
export const maxDistanceFor = (len: number) => (len >= 12 ? 3 : len >= 8 ? 2 : len >= MIN_WORD_LEN ? 1 : 0);

export type FixKind = "typo" | "anagram" | "prefix";
export interface Correction {
  /** Düzeltilmiş sorgu (özgün Türkçe yazımlarla) */
  text: string;
  /** Her düzeltme güçlü mü: tek en yakın aday, yeterince uzun kelime (bkz. fixWord). Son karar ürün sayısıyla verilir (lib/listing.ts). */
  confident: boolean;
  kinds: FixKind[];
}

const letters = (w: string) => [...w].sort().join("");

interface WordFix {
  word: string;
  kind: FixKind;
  confident: boolean;
}

function fixWord(w: string, vocab: Vocabulary, vocabWords: readonly string[], anagrams: ReadonlyMap<string, string[]>): WordFix | null {
  const max = maxDistanceFor(w.length);
  if (max === 0 || /\d/.test(w) || vocab.counts.has(w)) return null; // kısa, rakamlı/kod benzeri ya da zaten bilinen
  const top = (list: string[]) => list.sort((a, b) => (vocab.counts.get(b) ?? 0) - (vocab.counts.get(a) ?? 0) || (a < b ? -1 : 1))[0];

  // Yarım yazılmış kelime ("krist" → "kristal"): en çok ürünlü tamamlama
  const completions = vocabWords.filter((v) => v.startsWith(w));
  if (completions.length > 0) return { word: top(completions), kind: "prefix", confident: true };
  if (vocabWords.some((v) => v.includes(w))) return null; // kelimenin ortasından parça ("ronz") bilinen sayılır

  let best: { v: string; d: number; same: boolean; n: number } | null = null;
  let atBest = 0;
  for (const v of vocabWords) {
    const d = editDistance(w, v, max);
    if (d > max) continue;
    const cand = { v, d, same: v[0] === w[0], n: vocab.counts.get(v) ?? 0 };
    if (!best || cand.d < best.d) {
      best = cand;
      atBest = 1;
      continue;
    }
    if (cand.d === best.d) {
      atBest++;
      if (cand.same !== best.same ? cand.same : cand.n !== best.n ? cand.n > best.n : cand.v < best.v) best = cand;
    }
  }
  // Karışık harf ("zivae" → "avize"): aynı harf çoklu kümesine sahip TEK aday
  const same = w.length >= 5 ? (anagrams.get(letters(w)) ?? []).filter((v) => v !== w) : [];
  if (same.length === 1 && (!best || best.d > 1)) return { word: same[0], kind: "anagram", confident: true };
  if (!best) return null;
  // Güven: tek en yakın aday; 1 hata yalnızca 5+ harfli kelimede (4 harfte yanlış düzeltme riski yüksek)
  return { word: best.v, kind: "typo", confident: atBest === 1 && (best.d >= 2 || w.length >= 5) };
}

/**
 * Sorgudaki bilinmeyen kelimeleri tek tek düzeltir (çok kelimeli sorguda her kelime ayrı): yarım yazılmış → tamamlama, karışık harf → tek anagram, aksi hâlde
 * en yakın sözlük kelimesi. Değişiklik yoksa null. Bilinen sayılır: sözlükte olan ya da bir sözlük kelimesinin içinde geçen kelime, 4 harften kısa, rakamlı/kod benzeri kelime.
 * Eşitlikte sıra: küçük mesafe, aynı ilk harf, çok ürün, alfabetik (kararlı).
 */
export function correctQuery(q: string, vocab: Vocabulary): Correction | null {
  const words = normalizeSearch(q).split(" ").filter(Boolean).slice(0, MAX_QUERY_WORDS);
  if (words.length === 0 || vocab.counts.size === 0) return null;
  const vocabWords = [...vocab.counts.keys()];
  const anagrams = new Map<string, string[]>();
  for (const v of vocabWords) {
    const k = letters(v);
    anagrams.set(k, [...(anagrams.get(k) ?? []), v]);
  }
  const kinds: FixKind[] = [];
  let confident = true;
  const out = words.map((w) => {
    const fix = fixWord(w, vocab, vocabWords, anagrams);
    if (!fix) return vocab.display.get(w) ?? w;
    kinds.push(fix.kind);
    if (!fix.confident) confident = false;
    return vocab.display.get(fix.word) ?? fix.word;
  });
  return kinds.length > 0 ? { text: out.join(" "), confident, kinds } : null;
}

/** Yalnızca düzeltilmiş metin (geriye dönük kısa yol). */
export const suggestQuery = (q: string, vocab: Vocabulary): string | null => correctQuery(q, vocab)?.text ?? null;
