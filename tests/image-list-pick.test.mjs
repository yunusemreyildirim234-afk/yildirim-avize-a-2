import test from "node:test";
import assert from "node:assert/strict";
import { urlsToAppend } from "../lib/image-list.ts";

test("var olan görsel tekrar eklenmez", () => {
  assert.deepEqual(urlsToAppend(["a", "b"], ["b", "c"], 5), ["c"]);
});
test("seçimdeki tekrarlar tek sayılır", () => {
  assert.deepEqual(urlsToAppend([], ["a", "a", "b"], 5), ["a", "b"]);
});
test("sınır aşılmaz", () => {
  assert.deepEqual(urlsToAppend(["a", "b", "c"], ["d", "e", "f"], 5), ["d", "e"]);
  assert.deepEqual(urlsToAppend(["a", "b", "c", "d", "e"], ["f"], 5), []);
});
test("seçim sırası korunur, boş adres atlanır", () => {
  assert.deepEqual(urlsToAppend(["x"], ["c", "", "a", "b"], 5), ["c", "a", "b"]);
});
