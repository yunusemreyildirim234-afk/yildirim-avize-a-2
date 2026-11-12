import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVocabulary, correctQuery, suggestQuery, maxDistanceFor } from "../lib/search-fuzzy.ts";
import { applySynonyms, SYNONYMS } from "../lib/search-synonyms.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const vocab = buildVocabulary([
  { title: "Modern Kristal Avize 6'lı E27", rc: "Kristal" },
  { title: "Klasik Avize Altın", rc: "Klasik" },
  { title: "Sarkıt Aplik Siyah", rc: "Sarkıt" },
  { title: "Aydınlatma Aksesuar Zincir", rc: "Aksesuar" },
]);

test("karışık harf: tek anagram adayı önerilir", () => {
  const c = correctQuery("zivae", vocab);
  assert.equal(c?.text, "avize");
  assert.deepEqual(c?.kinds, ["anagram"]);
  assert.equal(c?.confident, true);
});

test("çok kelimeli sorguda her kelime ayrı düzeltilir", () => {
  assert.equal(suggestQuery("krital avzie", vocab), "kristal avize");
  assert.equal(suggestQuery("klask zivae", vocab), "klasik avize");
  assert.equal(correctQuery("avzie krital", vocab)?.confident, true);
});

test("önek: yarım yazılmış kelime tamamlanır", () => {
  const c = correctQuery("krist", vocab);
  assert.equal(c?.text, "kristal");
  assert.deepEqual(c?.kinds, ["prefix"]);
  assert.equal(suggestQuery("krist avzie", vocab), "kristal avize");
});

test("kod benzeri ve rakamlı kelimeler, kısa kelimeler düzeltilmez", () => {
  assert.equal(suggestQuery("e27", vocab), null);
  assert.equal(suggestQuery("e28", vocab), null);
  assert.equal(suggestQuery("45x25", vocab), null);
  assert.equal(suggestQuery("abc", vocab), null);
  assert.equal(suggestQuery("avzie e28", vocab), "avize e28"); // kod aynen kalır
  assert.equal(suggestQuery("avize", vocab), null);
});

test("uzun kelimede eşik artar: 12+ harf 3 hata", () => {
  assert.equal(maxDistanceFor(3), 0);
  assert.equal(maxDistanceFor(5), 1);
  assert.equal(maxDistanceFor(9), 2);
  assert.equal(maxDistanceFor(12), 3);
  const v = buildVocabulary([{ title: "Aydınlatmalarımız Avize" }]);
  assert.equal(suggestQuery("aydnlatmalarmz", v), "aydınlatmalarımız");
});

test("güven: belirsiz (eşit uzaklıkta çok aday) ya da 4 harfli düzeltme güvenli sayılmaz", () => {
  const v = buildVocabulary([{ title: "Bronz Avize" }, { title: "Pronz Lamba" }]);
  assert.equal(correctQuery("cronz", v)?.confident, false); // iki eşit aday
  const v4 = buildVocabulary([{ title: "Lamba Tavan" }]);
  assert.equal(correctQuery("tavn", v4)?.confident, false); // 4 harf
});

test("eş anlamlılar: normalize, kelime sınırında; eşleşme yoksa null", () => {
  assert.equal(applySynonyms("Lüster"), "avize");
  assert.equal(applySynonyms("LÜSTER modern"), "avize modern");
  assert.equal(applySynonyms("duvar lambası"), "aplik");
  assert.equal(applySynonyms("lüsteri"), null);
  assert.equal(applySynonyms("avize"), null);
  assert.equal(applySynonyms(""), null);
  for (const [, to] of SYNONYMS) assert.match(to, /^(avize|aplik|kristal|aksesuar)$/); // yalnızca katalogda karşılığı olanlar
});

test("listing: otomatik düzeltme eşiği ve eş anlamlı; veritabanına ek okuma yok", () => {
  const src = read("lib/listing.ts");
  const fn = src.slice(src.indexOf("export async function searchCorrection"), src.indexOf("/** Üst arama kutusu"));
  assert.match(src, /MIN_AUTO_RESULTS = 2/);
  assert.match(fn, /c\.confident && n >= MIN_AUTO_RESULTS/);
  assert.match(fn, /applySynonyms\(q\)/);
  assert.ok(!/prisma|\$queryRaw|findMany/.test(fn));
});

test("/arama: düzeltme satırı, 'tam' parametresi, filtreden gelen 0'da düzeltme yok, noindex", () => {
  const src = read("app/arama/page.tsx");
  assert.match(src, /=== "1"; \/\/ "Yine de ara"/);
  assert.match(src, /listing\.total === 0 && !exact && Object\.keys\(listing\.params\)\.every\(\(k\) => k === "siralama"\)/);
  assert.match(src, /sonuçları gösteriliyor/);
  assert.match(src, /için sonuç bulunamadı/);
  assert.match(src, /&tam=1/);
  assert.match(src, /robots: \{ index: false, follow: true \}/);
  assert.match(src, /alternates: \{ canonical: null \}/);
  assert.match(src, /fixed=\{\{ q \}\}/); // sayfalama/filtre bağlantıları özgün q'yu taşır
  assert.match(src, /redirect\(pageHref\(path, fix\.page, \{ q, \.\.\.listing\.params \}/);
});

test("/api/search ve NavSearch: düzeltilmiş ürünler + 'için gösteriliyor' satırı", () => {
  const api = read("app/api/search/route.ts");
  assert.match(api, /corrected = fix\.text/);
  assert.match(api, /\.\.\.\(corrected \? \{ corrected \} : \{\}\)/);
  assert.match(api, /rateLimit\(req, "search", 120, 60_000\)/);
  const nav = read("components/NavSearch.tsx");
  assert.match(nav, /için gösteriliyor/);
  assert.match(nav, /setCorrected\(typeof data\.corrected === "string" \? data\.corrected : null\)/);
});
