// /arama "önerilen" sıralaması için SAF alaka kuralları (veritabanı ve Next bağımlılığı yok; birim test edilebilir). Tek yerde, kolay genişletilir.
//
// Sıra anahtarı (küçükten büyüğe):
//   1) alaka puanı (büyük önce): tüm sorgu kelimeleri başlıkta → 2, ayrıca tam öbek başlıkta → 3, aksi 0
//   2) sorgu aksesuar anlamlı bir sözcük içermiyorsa "Aksesuar" kategorisindeki ürünün puanı en çok 2 olur (tam öbek bonusu almaz: "Kristal Avize Taşı" başlığı
//      "kristal avize" aramasında avizenin önüne geçmesin) ve puanı eşit avize/aplik/lamba ürünlerinin ARKASINA düşer
//   3) hâlâ eşitse: mevcut sıra (güncellik/id) aynen korunur

/** Sorguda bunlardan biri varsa kullanıcı aksesuar arıyordur: aksesuar ürünleri geri itilmez. Genişletmek için buraya ekleyin (ASCII, küçük harf; çok sözcüklü olabilir). */
export const ACCESSORY_WORDS: readonly string[] = ["aksesuar", "tas", "zincir", "ampul", "duy", "kapak", "kablo", "tavan gulu", "vida", "kanca", "abajur"];
/** Geri itilen kategorinin categoryKey değeri (lib/categories.ts: tr-TR küçük harf, ı→i). */
export const ACCESSORY_CATEGORY_KEY = "aksesuar";

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
/** Karşılaştırma biçimi: tr-TR küçük harf, Türkçe harfler ASCII, harf/rakam dışı her şey tek boşluk. */
export function normalizeSearch(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => TR[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Aranabilir metin: her alan ayrı normalize edilir, alanlar arasına sorguda bulunamayacak ayraç girer (öbek iki alana taşarak eşleşmesin). */
export function searchText(fields: readonly (string | null | undefined)[]): string {
  return fields.map((f) => normalizeSearch(f ?? "")).filter(Boolean).join("\n");
}

export interface SearchableRow {
  /** searchText çıktısı */
  search?: string;
  /** normalizeSearch(modelCode): yalnızca tam eşleşir */
  mc?: string | null;
}

/** Sorgu ile satır AYNI normalize işleminden geçer: IŞIK = ışık = isik = ISIK. Normalize sonucu boş sorgu hiçbir şeyle eşleşmez. */
export function matchesSearch(row: SearchableRow, q: string): boolean {
  const n = normalizeSearch(q);
  return !!n && (row.mc === n || (row.search ?? "").includes(n));
}

/**
 * İkinci geçiş (yalnızca öbek eşleşmesi hiç sonuç vermediğinde kullanılır, bkz. lib/listing.ts): en az iki farklı kelimenin HEPSİ aranabilir metinde
 * sırasız geçiyorsa eşleşir ("kristal avize" ↔ "Kristal Taşlı Avize"). Tek kelimeli sorguda öbek eşleşmesiyle aynıdır, burada false döner.
 */
export function matchesAllWords(row: SearchableRow, q: string): boolean {
  const words = [...new Set(normalizeSearch(q).split(" ").filter(Boolean))];
  const text = row.search ?? "";
  return words.length >= 2 && words.every((w) => text.includes(w));
}

/** Sıkıştırılmış eşleşme için en az sorgu uzunluğu (boşluksuz karakter): daha kısa sorgularda gürültü olmasın. */
export const COMPACT_MIN_LEN = 4;
/** Boşluksuz tek sözcük sorguyu iki kelimeye bölmek için en az uzunluk ve parça başına en az karakter ("kristalavize" → kristal + avize). */
const SPLIT_MIN_LEN = 6;
const SPLIT_PART_MIN = 3;

/** Boşluksuz biçim: normalize sonrası boşluklar atılır (alan ayracı "\n" korunur, alanlar arası eşleşme olmaz). */
export const compactSearch = (normalized: string): string => normalized.replace(/ /g, "");

// Satır başına bir kez hesaplanır (aynı satır nesnesi için); satır şekli/önbellek sürümü değişmez.
const compactMemo = new WeakMap<object, string>();
const compactOf = (row: SearchableRow): string => {
  let c = compactMemo.get(row);
  if (c === undefined) {
    c = compactSearch(row.search ?? "");
    compactMemo.set(row, c);
  }
  return c;
};

/**
 * Boşluksuz yazım (üçüncü geçiş; yalnızca öbek ve sırasız kelime eşleşmesi yetersizse kullanılır, bkz. lib/listing.ts):
 * sorgu ve metin boşluksuz karşılaştırılır ("e14duy" ↔ "E14 Duy", "krom aplik" ↔ "kromaplik"); en az COMPACT_MIN_LEN karakter.
 * Boşluksuz tek sözcük sorgu ayrıca iki parçaya bölünüp parçaların ikisi de metinde sırasız geçiyorsa eşleşir ("kristalavize" ↔ "Kristal Taşlı Avize").
 */
export function matchesCompact(row: SearchableRow, q: string): boolean {
  const n = normalizeSearch(q);
  const c = compactSearch(n);
  if (c.length < COMPACT_MIN_LEN) return false;
  if (row.mc && compactSearch(row.mc) === c) return true;
  if (compactOf(row).includes(c)) return true;
  if (n.includes(" ") || c.length < SPLIT_MIN_LEN) return false;
  const text = row.search ?? "";
  for (let i = SPLIT_PART_MIN; i <= c.length - SPLIT_PART_MIN; i++) {
    if (text.includes(c.slice(0, i)) && text.includes(c.slice(i))) return true;
  }
  return false;
}

/** Yalnızca rakamlardan (ve -, /, ., boşluk ayraçlarından) oluşan sorgu: model kodu / stok kodu olarak okunur ("154", "1-236"). */
export const isCodeQuery = (q: string): boolean => /^\d+(?:[-/. ]+\d+)*$/.test(q.trim());

/** Öbek eşleşmesi ya da sırasız tüm kelimeler (öneri doğrulaması için). */
export const matchesSearchTolerant = (row: SearchableRow, q: string) => matchesSearch(row, q) || matchesAllWords(row, q);

const ACC = ACCESSORY_WORDS.map(normalizeSearch);

/** Sorgu aksesuar anlamlı bir sözcük içeriyor mu? (tek sözcük: kelime başı eşleşmesi; çok sözcük: öbek) */
export function queryWantsAccessory(q: string): boolean {
  const n = normalizeSearch(q);
  if (!n) return false;
  const words = n.split(" ");
  return ACC.some((a) => (a.includes(" ") ? ` ${n} `.includes(` ${a} `) : words.some((w) => w === a || (a.length >= 4 && w.startsWith(a)))));
}

/** 0 (alakasız/yalnızca açıklama-kategori eşleşmesi), 2 (tüm kelimeler başlıkta), 3 (tam öbek başlıkta). */
export function titleScore(q: string, title: string): number {
  const nq = normalizeSearch(q);
  if (!nq) return 0;
  const nt = normalizeSearch(title);
  const words = [...new Set(nq.split(" "))];
  if (!words.every((w) => nt.includes(w))) return 0;
  return nt.includes(nq) ? 3 : 2;
}

export interface RankRow {
  id: string;
  title?: string;
  /** categoryKey(ürün kategorisi) */
  cat: string;
  /** Rakam sorgusunda model/stok kodu önceliği için (ListingRow ile aynı alanlar) */
  search?: string;
  mc?: string | null;
}

/** Rakam sorgusunda öncelik: 0 = model kodu tam eşleşir, 1 = stok kodu/barkod (arama metninde tam alan) tam eşleşir, 2 = diğer. Kod sorgusu değilse hep 2 (sıra değişmez). */
function codeTier(r: RankRow, n: string): number {
  if (r.mc && compactSearch(r.mc) === compactSearch(n)) return 0;
  return r.search && `\n${r.search}\n`.includes(`\n${n}\n`) ? 1 : 2;
}

/** Satırları (mevcut sırada verilir) alaka kuralıyla yeniden sıralar; kararlıdır, girdiyi değiştirmez. Boş sorguda aynen döner. */
export function rankSearchRows<R extends RankRow>(rows: readonly R[], q: string): R[] {
  if (!normalizeSearch(q)) return [...rows];
  const demote = !queryWantsAccessory(q);
  const code = isCodeQuery(q);
  const n = normalizeSearch(q);
  const key = rows.map((r, i) => {
    const back = demote && r.cat === ACCESSORY_CATEGORY_KEY ? 1 : 0;
    const score = titleScore(q, r.title ?? "");
    return { r, i, score: back ? Math.min(score, 2) : score, back, tier: code ? codeTier(r, n) : 2 };
  });
  key.sort((a, b) => a.tier - b.tier || b.score - a.score || a.back - b.back || a.i - b.i);
  return key.map((k) => k.r);
}
