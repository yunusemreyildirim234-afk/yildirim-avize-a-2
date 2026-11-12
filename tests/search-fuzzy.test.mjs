import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, buildVocabulary, suggestQuery } from "../lib/search-fuzzy.ts";

const rows = [
  { title: "Modern Kristal Avize 6'lı", rc: "Kristal Avize", vars: [{ c: { n: "Krom" } }] },
  { title: "Sarkıt Avize Siyah E27", rc: "Sarkıt Modelleri", vars: [{ c: { n: "Siyah" } }] },
  { title: "Aydınlatma Aksesuar Zincir", rc: "Aksesuar", vars: [] },
  { title: "Kristal Avize Taşı", rc: "Aksesuar" },
];
const vocab = buildVocabulary(rows);

test("editDistance: yer değişimi, ekleme, silme, değiştirme 1; max aşımında max+1", () => {
  assert.equal(editDistance("avzie", "avize", 2), 1);
  assert.equal(editDistance("krital", "kristal", 2), 1);
  assert.equal(editDistance("avizee", "avize", 2), 1);
  assert.equal(editDistance("avize", "avizo", 2), 1);
  assert.equal(editDistance("avize", "avize", 1), 0);
  assert.equal(editDistance("abcdef", "uvwxyz", 1), 2);
  assert.equal(editDistance("a", "abcdef", 2), 3);
});

test("buildVocabulary: rakamlı ve kısa kelimeler alınmaz; özgün Türkçe yazım saklanır", () => {
  assert.ok(vocab.counts.has("avize"));
  assert.ok(vocab.counts.has("kristal"));
  assert.ok(!vocab.counts.has("e27"));
  assert.ok(!vocab.counts.has("6"));
  assert.equal(vocab.display.get("aydinlatma"), "aydınlatma");
  assert.equal(vocab.display.get("sarkit"), "sarkıt");
  assert.equal(vocab.counts.get("avize"), 3);
});

test("suggestQuery: yer değişimi ve eksik harf düzelir", () => {
  assert.equal(suggestQuery("avzie", vocab), "avize");
  assert.equal(suggestQuery("krital", vocab), "kristal");
  assert.equal(suggestQuery("krital avize", vocab), "kristal avize");
  assert.equal(suggestQuery("KRİTAL", vocab), "kristal");
});

test("suggestQuery: doğru yazılmış, yarım yazılmış, kısa, rakamlı ve bilinmeyen uzak kelime önerilmez", () => {
  assert.equal(suggestQuery("avize", vocab), null);
  assert.equal(suggestQuery("kris", vocab), null);
  assert.equal(suggestQuery("abc", vocab), null);
  assert.equal(suggestQuery("e28", vocab), null);
  assert.equal(suggestQuery("45x25", vocab), null);
  assert.equal(suggestQuery("zzzzzz", vocab), null);
  assert.equal(suggestQuery("", vocab), null);
});

test("suggestQuery: boş sözlük null; öneri özgün Türkçe yazımla döner; uzun kelimede 2 hata", () => {
  assert.equal(suggestQuery("avzie", buildVocabulary([])), null);
  assert.equal(suggestQuery("aydinlatma", vocab), null); // ASCII yazım sözlükte var
  assert.equal(suggestQuery("aydnlatma", vocab), "aydınlatma");
  assert.equal(suggestQuery("aydnlatmaa", vocab), "aydınlatma"); // 2 hata, 10 harf
});

test("suggestQuery: eşitlikte çok ürünlü ve aynı ilk harfli aday seçilir (kararlı)", () => {
  const v = buildVocabulary([{ title: "Bronz Avize" }, { title: "Bronz Aplik" }, { title: "Pronz Lamba" }]);
  assert.equal(suggestQuery("ronz", v), null); // 4 harf, "bronz" içinde geçer → bilinen
  assert.equal(suggestQuery("brnoz", v), "bronz");
});
