import test from "node:test";
import assert from "node:assert/strict";
import { applyListing, parseListingParams, stateToParams, variationAttrs, parseSize, secenekColorName, auditSecenekValues, SECENEK_COLOR_ALLOWLIST, colorSwatch } from "../lib/listing-core.ts";

const sec = (v) => variationAttrs("Seçenek", v);
const show = (v) => {
  const a = sec(v);
  return [a.c?.n ?? null, a.s?.n ?? null];
};

// Canlı veritabanından bildirilen gerçek "Seçenek" değerleri → beklenen [renk, ebat]
const REAL = [
  ["Bej", "Bej", null], ["Standart", null, null], ["Sarı", "Sarı", null], ["SARI", "Sarı", null],
  ["Altın / 45 x 25", "Altın", "45 x 25"], ["Bej / 50 x 50", "Bej", "50 x 50"], ["yeşil / 45 x 25", "Yeşil", "45 x 25"],
  ["Eskitme", "Eskitme", null], ["eskitme", "Eskitme", null], ["Eskitme,", "Eskitme", null],
  ["PİRİNÇ ESKİTME", "Pirinç Eskitme", null], ["prinç eskitme / 67 x 67", "Pirinç Eskitme", "67 x 67"],
  ["şeffaf / 28 x 4", "Şeffaf", "28 x 4"], ["ŞEFFAF / 16 x 16", "Şeffaf", "16 x 16"], ["Krom / 63 x 63", "Krom", "63 x 63"],
  ["lak gold / 63 x 63", "Lak Gold", "63 x 63"], ["gold / 45 x 25", "Gold", "45 x 25"], ["BAL", "Bal", null], ["bal / 65 x 15", "Bal", "65 x 15"],
  ["Krem / 9 x 14", "Krem", "9 x 14"], ["lila, / 14 x 14", "Lila", "14 x 14"], ["Çok Renkli", "Çok Renkli", null], ["Metalik", "Metalik", null],
  ["Gümüş", "Gümüş", null], ["Turuncu", "Turuncu", null], ["Mor", "Mor", null], ["Lila", "Lila", null], ["Pembe", "Pembe", null],
  ["Kırmızı", "Kırmızı", null], ["Mavi", "Mavi", null], ["Kahverengi", "Kahverengi", null], ["Gri", "Gri", null], ["Beyaz", "Beyaz", null], ["Siyah", "Siyah", null],
];

test("gerçek Seçenek değerleri: ham değer → renk / ebat tablosu", () => {
  for (const [raw, color, size] of REAL) assert.deepEqual(show(raw), [color, size], raw);
});

test("aynı normalize ad tek anahtar (SARI = Sarı, Eskitme = eskitme = Eskitme,; Altın / Gold / Lak gold ayrı)", () => {
  assert.equal(sec("SARI").c.k, sec("Sarı").c.k);
  assert.equal(new Set(["Eskitme", "eskitme", "Eskitme,"].map((v) => sec(v).c.k)).size, 1);
  assert.equal(sec("PİRİNÇ ESKİTME").c.k, sec("prinç eskitme / 67 x 67").c.k);
  assert.equal(new Set(["Altın", "Gold", "Lak gold"].map((v) => sec(v).c.k)).size, 3);
  assert.equal(sec("Çok Renkli").c.k, "cok-renkli");
  assert.equal(sec("Pirinç Eskitme").c.k, "pirinc-eskitme");
});

test("liste dışı ilk parçalar renk sayılmaz (ama ebat okunabilir)", () => {
  for (const v of ["3'lü", "Tek kollu", "E14 duy", "45 x 25", "Renk", "", "Seçenek", "12 Watt"]) assert.equal(sec(v).c, null, v);
  assert.deepEqual(show("E14 duy / 30 x 30"), [null, "30 x 30"]);
  assert.equal(secenekColorName("Gold (0146)"), "gold"); // kod parantezi atılır
  assert.ok(SECENEK_COLOR_ALLOWLIST.includes("lak gold") && SECENEK_COLOR_ALLOWLIST.length === 38);
});

test('"Renk" türü eskisi gibi: olduğu gibi kabul, izin listesi yok; ikinci parça ebatsa ilk parça', () => {
  const r = (v) => variationAttrs("Renk", v);
  assert.equal(r("E2Erenk Bej (0146)").c.k, r("E2Erenk Bej").c.k);
  assert.equal(r("E2Erenk Bej").c.n, "E2Erenk Bej");
  assert.equal(r("Gold (Mat)").c.k, "gold-mat");
  assert.equal(r("Standart").c, null);
  assert.equal(r("Gold / Siyah").c.k, "gold-siyah"); // ebat olmayan ikinci parça: bütün değer (eski davranış)
  assert.deepEqual([r("Altın / 45 x 25").c.n, r("Altın / 45 x 25").s.n], ["Altın", "45 x 25"]);
  assert.deepEqual(variationAttrs("Başka", "Bej / 45 x 25"), { c: null, s: null });
});

test("ebat kalıbı: x/X/×, boşluksuz, ondalık; kalıba uymayan ikinci parça ebat değil", () => {
  assert.deepEqual(show("Altın / 45 x 25"), ["Altın", "45 x 25"]);
  assert.deepEqual(show("bej / 50x50"), ["Bej", "50 x 50"]);
  assert.deepEqual(show("Sarı / 12 X 12"), ["Sarı", "12 x 12"]);
  assert.deepEqual(show("Sarı / 12×12"), ["Sarı", "12 x 12"]);
  assert.deepEqual(show("Sarı / 12,5 x 10.25"), ["Sarı", "12,5 x 10,25"]);
  assert.equal(sec("Sarı / 12,5 x 10").s.k, "12.5x10");
  assert.equal(sec("Sarı / 045 x 25").s.k, "45x25");
  for (const bad of ["E27", "45", "45 x", "x 45", "45 x 25 x 10", "45 cm", "45 x 25 cm", "0 x 0", "abc x def", ""]) assert.equal(parseSize(bad), null, bad);
  assert.equal(sec("Sarı / E27").s, null);
  assert.equal(sec("Sarı").s, null); // tek parça: ebat yok
  assert.equal(sec("45 x 25").s, null);
});

test("ham değerlerde denetim raporu: liste dışı ilk parçalar ve ebat olmayan ikinci parçalar", () => {
  const rep = auditSecenekValues(["Bej / 50 x 50", "3'lü", "3'lü", "E14 duy / E14", "Tek kollu", "Sarı / x"]);
  assert.deepEqual(rep.unlistedFirstParts, [["3'lü", 2], ["e14 duy", 1], ["tek kollu", 1]]);
  assert.deepEqual(rep.nonSizeSecondParts, [["e14", 1], ["x", 1]]);
});

test("renk örneği tablosu: yeni renkler ve bileşik anahtarlar; bilinmeyen/çok renkli nötr", () => {
  for (const k of ["lila", "bal", "metalik", "eskitme", "pirinc-eskitme", "lak-gold", "krom", "gumus", "bakir", "bronz", "sari", "altin", "gold", "krem", "seffaf"]) assert.match(colorSwatch(k) ?? "", /^#[0-9a-f]{6}$/, k);
  assert.equal(colorSwatch("cok-renkli"), null);
  assert.equal(colorSwatch("zzz"), null);
});

// ---- Filtre: renk + ebat ----
const CATS = [{ key: "kristal", slug: "kristal", title: "Kristal" }];
const row = (id, ...vals) => ({ id, cat: "kristal", price: 100, created: 1, updated: 1, featured: false, vars: vals.map((v) => sec(v)) });
// p1: Sarı/40x40 + Bej/50x50 (farklı varyasyonlar), p2: Sarı/50x50, p3: Bej/40x40, p4: yalnızca Sarı (ebatsız), p5: ebat yok, renk yok
const ROWS = [row("p1", "SARI / 40 x 40", "Bej / 50 x 50"), row("p2", "Sarı / 50x50"), row("p3", "bej / 40 X 40"), row("p4", "Sarı"), { ...row("p5"), vars: [] }];
const run = (q) => applyListing(ROWS, parseListingParams(q), { cats: CATS });
const f = (arr) => arr.map((x) => [x.key, x.count]);

test("yalnızca renk ya da yalnızca ebat: ürün düzeyinde eşleşme", () => {
  assert.deepEqual(run({ renk: "sari" }).ids, ["p1", "p2", "p4"]);
  assert.deepEqual(run({ ebat: "50x50" }).ids, ["p1", "p2"]);
  assert.deepEqual(run({ ebat: "50x50,40x40" }).ids, ["p1", "p2", "p3"]);
});

test("renk + ebat: AYNI varyasyonda eşleşme (dağılmış eşleşme sayılmaz)", () => {
  // p1 Sarı'yı 40x40'ta, 50x50'yi Bej'de taşır → Sarı+50x50 için p1 EŞLEŞMEZ
  assert.deepEqual(run({ renk: "sari", ebat: "50x50" }).ids, ["p2"]);
  assert.deepEqual(run({ renk: "sari", ebat: "40x40" }).ids, ["p1"]);
  assert.deepEqual(run({ renk: "sari,bej", ebat: "50x50" }).ids, ["p1", "p2"]);
  assert.deepEqual(run({ renk: "bej", ebat: "40x40" }).ids, ["p3"]);
});

test("facet sayıları: ebat sayıları renge, renk sayıları ebada göre (aynı varyasyon); kendi filtresinden bağımsız", () => {
  const none = run({});
  assert.deepEqual(f(none.facets.sizes), [["40x40", 2], ["50x50", 2]]);
  assert.deepEqual(f(none.facets.colors), [["bej", 2], ["sari", 3]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  const bySari = run({ renk: "sari" });
  assert.deepEqual(f(bySari.facets.sizes), [["40x40", 1], ["50x50", 1]]); // yalnızca Sarı varyasyonları
  assert.deepEqual(f(bySari.facets.colors), f(none.facets.colors)); // renk sayıları kendi filtresinden bağımsız
  const byEbat = run({ ebat: "50x50" });
  assert.deepEqual(f(byEbat.facets.colors), [["bej", 1], ["sari", 1]]);
  assert.deepEqual(f(byEbat.facets.sizes), f(none.facets.sizes));
  assert.equal(byEbat.total, 2);
  // seçili renk+ebat için sayılar: Sarı+50x50 → ebat sayısı 50x50: 1 (p2); kategori sayısı sonuçla aynı
  const both = run({ renk: "sari", ebat: "50x50" });
  assert.equal(both.facets.categories[0].count, both.total);
});

test("ebatsız listede ebat bölümü yok; ürün başına tek sayım", () => {
  const rows = [row("a", "Bej"), row("b", "Sarı")];
  assert.deepEqual(applyListing(rows, parseListingParams({}), { cats: CATS }).facets.sizes, []);
  const dup = applyListing([row("a", "Bej / 40 x 40", "bej / 40x40")], parseListingParams({}), { cats: CATS });
  assert.deepEqual(f(dup.facets.sizes), [["40x40", 1]]);
  assert.deepEqual(f(dup.facets.colors), [["bej", 1]]);
});

test("ebat sırası: sayıya göre azalan, eşitlikte ölçüye göre artan", () => {
  const rows = [row("a", "Bej / 60 x 60"), row("b", "Bej / 9 x 14"), row("c", "Bej / 9 x 14"), row("d", "Bej / 45 x 25")];
  assert.deepEqual(f(applyListing(rows, parseListingParams({}), { cats: CATS }).facets.sizes), [["9x14", 2], ["45x25", 1], ["60x60", 1]]);
});

test("ebat adres parametresi: boşluk/×/X tolere, geçersiz yok sayılır, sınırlı, bilinmeyen evrene göre atılır; URL boşluksuz", () => {
  assert.deepEqual(parseListingParams({ ebat: "45 X 25,50×50, 12.5x10" }).ebatlar, ["45x25", "50x50", "12.5x10"]);
  assert.deepEqual(parseListingParams({ ebat: ["45x25", "45x25", "abc", "<b>", "45", "x", "../x", "99999x1", "1x1x1"] }).ebatlar, ["45x25"]);
  assert.ok(parseListingParams({ ebat: "1".repeat(500) }).ebatlar.length === 0);
  assert.ok(parseListingParams({ ebat: Array.from({ length: 100 }, (_, i) => `${i + 1}x${i + 1}`).join(",") }).ebatlar.length <= 12);
  assert.deepEqual(run({ ebat: "7x7" }).state.ebatlar, []); // evrende yok → sessizce atılır
  assert.equal(run({ ebat: "7x7" }).total, 5);
  const s = parseListingParams({ renk: "sari", ebat: "50 x 50,40x40", fiyat_min: "10" });
  assert.deepEqual(stateToParams(s), { renk: "sari", ebat: "50x50,40x40", fiyat_min: "10" });
  assert.deepEqual(stateToParams(parseListingParams({ ebat: "zzz" })), {});
});
