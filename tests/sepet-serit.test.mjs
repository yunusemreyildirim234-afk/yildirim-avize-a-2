import test from "node:test";
import assert from "node:assert/strict";
import { CART_STRIP_MAX_CATEGORIES, cartCategories, cartStripList, mixedList } from "../lib/cart-strip.ts";
import { collectPage, mergeUnique } from "../lib/similar-strip.ts";

const row = (id, rc, over = {}) => ({ id, rc, active: true, inStock: true, updated: 100, ...over });
const many = (rc, n, tag) => Array.from({ length: n }, (_, i) => row(`${tag}${String(i).padStart(2, "0")}`, rc, { updated: 1000 - i }));
const fetcherOf = (log = []) => async (w) => {
  log.push(w);
  return w.map((id) => ({ id }));
};

test("cartCategories: sepet sırasıyla, tekrarsız; sonuç ada göre sıralı", () => {
  const rows = [row("a", "Modern"), row("b", "Kristal"), row("c", "Modern")];
  assert.deepEqual(cartCategories(rows, ["a", "b", "c"]), ["Kristal", "Modern"]);
  assert.deepEqual(cartCategories(rows, ["c", "b", "a"]), ["Kristal", "Modern"]); // sepet sırası anahtarı değiştirmez
});

test("cartCategories: en çok 5 kategori (sepet sırasına göre ilk 5)", () => {
  const rows = ["A", "B", "C", "D", "E", "F", "G"].map((c, i) => row(`p${i}`, c));
  const got = cartCategories(rows, rows.map((r) => r.id));
  assert.equal(got.length, CART_STRIP_MAX_CATEGORIES);
  assert.deepEqual(got, ["A", "B", "C", "D", "E"]);
});

test("cartCategories: kategorisi bulunamayan/boş ürün atlanır; hiç kategori yoksa boş", () => {
  const rows = [row("a", "Modern"), row("b", "  ")];
  assert.deepEqual(cartCategories(rows, ["yok", "b", "a"]), ["Modern"]);
  assert.deepEqual(cartCategories(rows, ["yok", "b"]), []);
  assert.deepEqual(cartCategories(rows, []), []);
  assert.deepEqual(cartStripList(rows, []), []);
});

test("mixedList: kategoriler dönüşümlü (round-robin), her kategoride kararlı sıra", () => {
  const rows = [...many("Kristal", 3, "k"), ...many("Modern", 2, "m")];
  assert.deepEqual(mixedList(rows, ["Kristal", "Modern"]), ["k00", "m00", "k01", "m01", "k02"]);
});

test("mixedList: kararlı sıra updatedAt azalan, eşitse id artan; stoksuz/pasif girmez", () => {
  const rows = [row("b", "K", { updated: 5 }), row("a", "K", { updated: 5 }), row("z", "K", { updated: 9 }), row("x", "K", { inStock: false }), row("y", "K", { active: false })];
  assert.deepEqual(mixedList(rows, ["K"]), ["z", "a", "b"]);
  assert.deepEqual(mixedList([...rows].reverse(), ["K"]), ["z", "a", "b"]);
});

test("mixedList: tek kategori düz liste; boş kategori kümesi boş", () => {
  const rows = many("Kristal", 3, "k");
  assert.deepEqual(mixedList(rows, ["Kristal"]), ["k00", "k01", "k02"]);
  assert.deepEqual(mixedList(rows, []), []);
});

test("sepetteki ürün şeritte çıkarılır ama pencere kimlikleri sepete göre değişmez (önbellek parçalanmaz)", async () => {
  const rows = [...many("Kristal", 12, "k"), ...many("Modern", 12, "m")];
  const listA = cartStripList(rows, ["k00"]); // sepet: yalnız Kristal
  const listB = cartStripList(rows, ["k05", "m03"]); // sepet: iki kategori
  assert.deepEqual(cartStripList(rows, ["k01", "k02"]), listA); // aynı kategori kümesi → aynı liste
  const a = [];
  const b = [];
  await collectPage(listA, new Set(["k00"]), 0, 8, fetcherOf(a));
  await collectPage(listA, new Set(["k03", "k07"]), 0, 8, fetcherOf(b));
  assert.deepEqual(a, b);
  assert.notDeepEqual(listA, listB);
});

test("collectPage sepet kümesiyle: sepettekiler atılır, sayfalama/hasMore ve tekrarsızlık", async () => {
  const rows = [...many("Kristal", 10, "k"), ...many("Modern", 10, "m")];
  const inCart = new Set(["k00", "m01"]);
  const list = cartStripList(rows, ["k00", "m01"]);
  assert.equal(list.length, 20);
  let items = [];
  let cursor = 0;
  let hasMore = true;
  let pages = 0;
  while (hasMore) {
    const p = await collectPage(list, inCart, cursor, 8, fetcherOf());
    assert.ok(p.items.length <= 8);
    items = mergeUnique(items, p.items);
    cursor = p.cursor;
    hasMore = p.hasMore;
    pages++;
  }
  assert.equal(pages, 3);
  assert.deepEqual(items.map((i) => i.id), list.filter((id) => !inCart.has(id)));
});

test("collectPage: kategori kısa ise tek sayfa, hasMore=false; sepet ürünü tek ürünse boş", async () => {
  const rows = many("Kristal", 4, "k");
  const p = await collectPage(cartStripList(rows, ["k00"]), new Set(["k00"]), 0, 8, fetcherOf());
  assert.equal(p.items.length, 3);
  assert.equal(p.hasMore, false);
  const solo = await collectPage(cartStripList([row("s", "X")], ["s"]), new Set(["s"]), 0, 8, fetcherOf());
  assert.deepEqual(solo.items, []);
  assert.equal(solo.hasMore, false);
});

test("collectPage: boş pencere çıkarsa sonrakine geçer", async () => {
  const rows = many("Kristal", 20, "k");
  const list = cartStripList(rows, ["k00"]);
  const p = await collectPage(list, new Set(), 0, 8, async (w) => (w[0] === "k00" ? [] : w.map((id) => ({ id }))));
  assert.equal(p.items.length, 8);
  assert.equal(p.cursor, 16);
});
