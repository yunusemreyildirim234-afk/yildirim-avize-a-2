import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, queryWantsAccessory, titleScore, rankSearchRows } from "../lib/search-rank.ts";

// Mevcut (güncellik) sırası dizi sırasıdır
const R = (id, title, cat = "kristal") => ({ id, title, cat });

test("normalizeSearch: Türkçe harfler ve noktalama sadeleşir", () => {
  assert.equal(normalizeSearch("  Kristal-TAŞ, İpek  "), "kristal tas ipek");
  assert.equal(normalizeSearch("ÇIĞ"), "cig");
});

test("titleScore: tüm kelimeler başlıkta → 2, tam öbek → 3, eksik kelime → 0", () => {
  assert.equal(titleScore("kristal avize", "Kristal Avize 6'lı"), 3);
  assert.equal(titleScore("kristal avize", "Avize kristal damla"), 2); // sıra farklı: öbek değil
  assert.equal(titleScore("kristal avize", "Kristal Taş 12 mm"), 0);
  assert.equal(titleScore("", "x"), 0);
});

test("queryWantsAccessory: küçük, genişletilebilir liste", () => {
  for (const q of ["aksesuar", "kristal taş", "kristal tas", "avize zinciri", "ampul e14", "tavan gülü", "duy", "kablo"]) assert.equal(queryWantsAccessory(q), true, q);
  for (const q of ["kristal avize", "avize", "aplik", "masa lambası", "", "duyarlı"]) assert.equal(queryWantsAccessory(q), false, q);
});

test("kural 1-2: tüm kelimeler başlıkta olanlar önde; tam öbek daha önde", () => {
  const rows = [R("a", "Kristal Taş"), R("b", "Avize kristal damla"), R("c", "Kristal Avize Gold")];
  assert.deepEqual(rankSearchRows(rows, "kristal avize").map((r) => r.id), ["c", "b", "a"]);
});

test("kural 3: puan eşitse mevcut sıra korunur (kararlı)", () => {
  const rows = [R("z", "Kristal Avize 1"), R("a", "Kristal Avize 2"), R("m", "Kristal Avize 3")];
  assert.deepEqual(rankSearchRows(rows, "kristal avize").map((r) => r.id), ["z", "a", "m"]);
});

test("kural 4: puanı eşit aksesuar, avize/aplik/lamba ürünlerinin arkasına düşer; sorguda aksesuar sözcüğü varsa düşmez", () => {
  const rows = [R("t1", "Kristal Damla", "aksesuar"), R("t2", "Kristal Prizma", "aksesuar"), R("av", "Kristal Avize Zincirli", "kristal"), R("ap", "Kristal Aplik", "modern")];
  assert.deepEqual(rankSearchRows(rows, "kristal").map((r) => r.id), ["av", "ap", "t1", "t2"]);
  assert.deepEqual(rankSearchRows(rows, "kristal aksesuar").map((r) => r.id), ["t1", "t2", "av", "ap"]); // sorguda aksesuar sözcüğü var: puanlar eşit (0), geri itme yok → mevcut sıra
  assert.deepEqual(rankSearchRows(rows, "kristal taş").map((r) => r.id), ["t1", "t2", "av", "ap"]);
});

test("alaka puanı aksesuar cezasından önce gelir (daha yüksek puanlı aksesuar, düşük puanlı avizenin önünde)", () => {
  const rows = [R("av", "Gold Avize", "kristal"), R("ak", "Kristal Avize Zinciri", "aksesuar")];
  assert.deepEqual(rankSearchRows(rows, "kristal avize").map((r) => r.id), ["ak", "av"]);
});

test("girdi değişmez; boş sorgu aynen döner", () => {
  const rows = [R("a", "x"), R("b", "y", "aksesuar")];
  const copy = [...rows];
  rankSearchRows(rows, "x");
  assert.deepEqual(rows, copy);
  assert.deepEqual(rankSearchRows(rows, "   ").map((r) => r.id), ["a", "b"]);
});

test("aksesuar başlığında tam öbek olsa da (Kristal Avize Taşı) sorguda aksesuar sözcüğü yoksa avizenin önüne geçmez", () => {
  const rows = [R("t", "Kristal Avize Taşı Kontes Uyumlu", "aksesuar"), R("av", "Nova Model Kristal 6'lı Krom Avize", "kristal")];
  assert.deepEqual(rankSearchRows(rows, "kristal avize").map((r) => r.id), ["av", "t"]);
  assert.deepEqual(rankSearchRows(rows, "kristal avize taşı").map((r) => r.id), ["t", "av"]); // aksesuar sözcüğü (taş) var: bonus ve sıra korunur
});
