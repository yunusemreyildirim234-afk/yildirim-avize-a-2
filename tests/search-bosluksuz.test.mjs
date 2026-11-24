import test from "node:test";
import assert from "node:assert/strict";
import { searchText, matchesSearch, matchesAllWords, matchesCompact, isCodeQuery, rankSearchRows, normalizeSearch } from "../lib/search-rank.ts";
import { matchesOrderSearch } from "../lib/admin-order-search.ts";
import { searchAdminProducts, adminCodeFirst } from "../lib/admin-product-search.ts";

const row = (title, extra = {}) => ({ id: title, title, cat: "kristal", search: searchText([title, ...(extra.fields ?? [])]), mc: extra.mc ? normalizeSearch(extra.mc) : null });
// Listeleme sırası: normal → sırasız kelime → boşluksuz (lib/listing.ts searchRows ile aynı)
const find = (rows, q) => {
  const a = rows.filter((r) => matchesSearch(r, q));
  if (a.length) return a;
  const b = rows.filter((r) => matchesAllWords(r, q));
  return b.length ? b : rows.filter((r) => matchesCompact(r, q));
};

test("boşluksuz: kristalavize hem 'Kristal Avize' hem 'Kristal Taşlı Avize' ile eşleşir", () => {
  assert.equal(matchesCompact(row("Kristal Avize"), "kristalavize"), true);
  assert.equal(matchesCompact(row("Kristal Taşlı Avize"), "kristalavize"), true); // iki parçaya bölme
  assert.equal(matchesCompact(row("Modern Aplik"), "kristalavize"), false);
});

test("boşluksuz: e14duy, 7wled, krom aplik ↔ kromaplik", () => {
  assert.equal(matchesCompact(row("E14 Duy"), "e14duy"), true);
  assert.equal(matchesCompact(row("7 W Led Ampul"), "7wled"), true);
  assert.equal(matchesCompact(row("Kromaplik Duvar"), "krom aplik"), true);
  assert.deepEqual(find([row("E14 Duy"), row("Avize")], "E14DUY").map((r) => r.id), ["E14 Duy"]);
});

test("boşluksuz: 3 karakterlik sorguda devreye girmez, alanlar arası taşmaz", () => {
  assert.equal(matchesCompact(row("E 14 Duy"), "e14"), false);
  assert.equal(matchesCompact(row("Kristal", { fields: ["Avize"] }), "kristalav"), false); // alan sınırı: başlık+kategori birleşmez
});

test("boşluksuz: normal eşleşme varsa ikinci geçiş çalışmaz", () => {
  const rows = [row("Kristal Avize"), row("Kristalavize Özel")];
  assert.deepEqual(find(rows, "kristal avize").map((r) => r.id), ["Kristal Avize"]);
});

test("rakam sorgusu: model kodu eşleşen en üstte, stok kodu sonra, eşleşmeyen gelmez", () => {
  const rows = [row("Avize 154 cm"), row("Tavan Avize", { fields: ["154"] }), row("Salon Avize", { mc: "154" }), row("Alakasız Aplik")];
  assert.equal(isCodeQuery("154"), true);
  assert.equal(isCodeQuery("1-236"), true);
  assert.equal(isCodeQuery("kristal 154"), false);
  const out = rankSearchRows(find(rows, "154"), "154").map((r) => r.id);
  assert.deepEqual(out, ["Salon Avize", "Tavan Avize", "Avize 154 cm"]);
});

test("rakam sorgusu 1-236: model kodu biçimi", () => {
  const rows = [row("A", { mc: "2-236" }), row("B", { mc: "1-236" })];
  assert.deepEqual(rankSearchRows(find(rows, "1-236"), "1-236").map((r) => r.id), ["B"]);
});

test("rakam olmayan sorguda sıra kuralı değişmez", () => {
  const rows = [row("Avize X", { mc: "kristal" }), row("Kristal Avize")];
  assert.deepEqual(rankSearchRows(rows, "kristal avize").map((r) => r.id), ["Kristal Avize", "Avize X"]);
});

test("admin sipariş: ahmetyilmaz ad ve e-postada; telefon/kod davranışı bozulmaz", () => {
  const o = { id: "abcd1234-0000", phone: "0532 111 22 33", recipientName: null, user: { name: "Ahmet Yılmaz", email: "a@x.com" } };
  assert.equal(matchesOrderSearch(o, "ahmetyilmaz"), true);
  assert.equal(matchesOrderSearch(o, "AHMETYILMAZ"), true);
  assert.equal(matchesOrderSearch(o, "mehmetyilmaz"), false);
  assert.equal(matchesOrderSearch(o, "abc"), true); // kimlik
  assert.equal(matchesOrderSearch(o, "5321112233"), true); // telefon
  assert.equal(matchesOrderSearch(o, "5559998877"), false);
});

test("admin ürün: boşluksuz yazım yalnız normal sonuç yoksa; rakam sorgusunda model kodu önde", () => {
  const P = (title, modelCode, codes = []) => ({ title, modelCode, trendyolMainId: null, variations: codes.map((c) => ({ stockCode: c })) });
  const list = [P("Kristal Avize", "9"), P("Kristal Taşlı Avize", "8")];
  assert.deepEqual(searchAdminProducts(list, "kristalavize").map((p) => p.modelCode), ["9"]);
  assert.deepEqual(searchAdminProducts(list, "kri").length, 2);
  assert.equal(searchAdminProducts(list, "kri ").length, 2);
  const L = [P("Avize 154", "1"), P("Aplik", "2", ["154"]), P("Duy", "154")];
  assert.deepEqual(adminCodeFirst(searchAdminProducts(L, "154"), "154").map((p) => p.title), ["Duy", "Aplik", "Avize 154"]);
  assert.deepEqual(adminCodeFirst(L, "avize").map((p) => p.title), ["Avize 154", "Aplik", "Duy"]);
});
