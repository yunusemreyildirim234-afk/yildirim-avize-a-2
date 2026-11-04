import test from "node:test";
import assert from "node:assert/strict";
import { MAX_COLLECTIONS, editorSelection, moveKey, pickCollections, resolveCollectionKeys, validateCollectionKeys } from "../lib/collections.ts";

const list = [
  { key: "kristal", count: 5 },
  { key: "modern", count: 3 },
  { key: "klasik", count: 0 },
  { key: "sarkit", count: 2 },
  { key: "yemek masasi", count: 4 },
];

test("ayar yokken tüm kategoriler listedeki sırayla, ürünsüz olan görünmez", () => {
  assert.deepEqual(pickCollections(list, []).map((c) => c.key), ["kristal", "modern", "sarkit", "yemek masasi"]);
});

test("kayıtlı seçim: yalnızca seçilenler, seçim sırasıyla", () => {
  assert.deepEqual(pickCollections(list, ["yemek masasi", "kristal"]).map((c) => c.key), ["yemek masasi", "kristal"]);
});

test("silinmiş ve ürünsüz kategori atlanır, tekrar eden tek sayılır", () => {
  assert.deepEqual(pickCollections(list, ["silinmis", "klasik", "modern", "modern"]).map((c) => c.key), ["modern"]);
});

test("seçimdeki hiçbir kategori geçerli değilse varsayılana düşer", () => {
  assert.deepEqual(pickCollections(list, ["silinmis", "klasik"]).map((c) => c.key), ["kristal", "modern", "sarkit", "yemek masasi"]);
});

test("resolveCollectionKeys: bozuk/eksik ham veri boş, geçersiz öğeler atılır", () => {
  assert.deepEqual(resolveCollectionKeys(null), []);
  assert.deepEqual(resolveCollectionKeys({}), []);
  assert.deepEqual(resolveCollectionKeys({ collections: "x" }), []);
  assert.deepEqual(resolveCollectionKeys({ collections: ["a", 3, "", "a", "b"] }), ["a", "b"]);
});

test("validateCollectionKeys", () => {
  assert.deepEqual(validateCollectionKeys(["a", "b"]), { ok: true, keys: ["a", "b"] });
  assert.equal(validateCollectionKeys("a").ok, false);
  assert.equal(validateCollectionKeys(["a", "a"]).ok, false);
  assert.equal(validateCollectionKeys(["a", ""]).ok, false);
  assert.equal(validateCollectionKeys([1]).ok, false);
  assert.equal(validateCollectionKeys(Array.from({ length: MAX_COLLECTIONS + 1 }, (_, i) => `k${i}`)).ok, false);
  assert.equal(validateCollectionKeys([]).ok, true);
});

test("editorSelection: kayıt yoksa tümü (custom=false); kayıt varsa geçerli sırası", () => {
  assert.deepEqual(editorSelection(list, []), { selected: ["kristal", "modern", "sarkit", "yemek masasi"], custom: false });
  assert.deepEqual(editorSelection(list, ["sarkit", "silinmis", "klasik", "kristal"]), { selected: ["sarkit", "kristal"], custom: true });
  assert.equal(editorSelection(list, ["silinmis"]).custom, false);
});

test("moveKey: yer değiştirir, sınırda değişmez, girdiyi bozmaz", () => {
  const a = ["x", "y", "z"];
  assert.deepEqual(moveKey(a, 1, -1), ["y", "x", "z"]);
  assert.deepEqual(moveKey(a, 1, 1), ["x", "z", "y"]);
  assert.deepEqual(moveKey(a, 0, -1), a);
  assert.deepEqual(moveKey(a, 2, 1), a);
  assert.deepEqual(a, ["x", "y", "z"]);
});
