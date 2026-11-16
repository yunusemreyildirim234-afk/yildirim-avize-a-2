import test from "node:test";
import assert from "node:assert/strict";
import { SIMILAR_PAGE_SIZE, collectPage, mergeUnique, nearEnd, similarList } from "../lib/similar-strip.ts";

const row = (id, over = {}) => ({ id, rc: "Kristal", active: true, inStock: true, updated: 100, ...over });
const ids = (n, prefix = "p") => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, "0")}`);
const fetcherOf = (log = []) => async (w) => {
  log.push(w);
  return w.map((id) => ({ id }));
};

test("similarList: yalnız aynı kategori, aktif ve stoklu; kategori tam eşitlik", () => {
  const rows = [row("a"), row("b", { rc: "Modern" }), row("c", { active: false }), row("d", { inStock: false }), row("e", { rc: "KRISTAL" }), row("f", { inStock: undefined })];
  assert.deepEqual(similarList(rows, "Kristal"), ["a"]);
});

test("similarList: sıra updatedAt azalan, eşitse id artan (kararlı)", () => {
  const rows = [row("b", { updated: 5 }), row("a", { updated: 5 }), row("z", { updated: 9 }), row("m", { updated: 1 })];
  assert.deepEqual(similarList(rows, "Kristal"), ["z", "a", "b", "m"]);
  assert.deepEqual(similarList([...rows].reverse(), "Kristal"), ["z", "a", "b", "m"]);
});

test("collectPage: ilk sayfa 8 ürün, hasMore doğru", async () => {
  const p = await collectPage(ids(20), "yok", 0, SIMILAR_PAGE_SIZE, fetcherOf());
  assert.equal(p.items.length, 8);
  assert.equal(p.cursor, 8);
  assert.equal(p.hasMore, true);
});

test("collectPage: kendi ürün çıkarılır (o pencere 7 ürün), tek pencere okunur, hizalı", async () => {
  const list = ids(20);
  const log = [];
  const p = await collectPage(list, "p03", 0, 8, fetcherOf(log));
  assert.equal(p.items.length, 7);
  assert.ok(!p.items.some((i) => i.id === "p03"));
  assert.equal(log.length, 1);
  assert.deepEqual(log[0], list.slice(0, 8));
  assert.equal(p.cursor, 8);
  assert.equal(p.hasMore, true);
});

test("collectPage: pencere boş çıkarsa ve liste sürüyorsa sonrakine geçer", async () => {
  const list = ids(20);
  const p = await collectPage(list, "yok", 0, 8, async (w) => (w[0] === "p00" ? [] : w.map((id) => ({ id }))));
  assert.equal(p.items.length, 8);
  assert.equal(p.cursor, 16);
});

test("collectPage: pencere kimlikleri kendi ürüne göre değişmez (önbellek parçalanmaz)", async () => {
  const list = ids(30);
  const a = [];
  const b = [];
  await collectPage(list, "p01", 8, 8, fetcherOf(a));
  await collectPage(list, "p25", 8, 8, fetcherOf(b));
  assert.deepEqual(a[0], b[0]);
});

test("collectPage: kategori biter, hasMore=false", async () => {
  const list = ids(11);
  const p1 = await collectPage(list, "yok", 0, 8, fetcherOf());
  const p2 = await collectPage(list, "yok", p1.cursor, 8, fetcherOf());
  assert.equal(p2.items.length, 3);
  assert.equal(p2.hasMore, false);
  assert.equal(p2.cursor, 11);
});

test("collectPage: liste tam 8 ise tek sayfa; kendi ürün tek ürünse boş; boş liste", async () => {
  const p = await collectPage(ids(8), "yok", 0, 8, fetcherOf());
  assert.equal(p.items.length, 8);
  assert.equal(p.hasMore, false);
  assert.deepEqual(await collectPage(["x"], "x", 0, 8, fetcherOf()), { items: [], cursor: 1, hasMore: false });
  assert.deepEqual(await collectPage([], "x", 0, 8, fetcherOf()), { items: [], cursor: 0, hasMore: false });
});

test("collectPage: okumada bulunamayan ürün atlanır, kimlik sırası korunur", async () => {
  const list = ids(8);
  const p = await collectPage(list, "yok", 0, 8, async (w) => w.filter((id) => id !== "p02").reverse().map((id) => ({ id })));
  assert.deepEqual(p.items.map((i) => i.id), list.filter((id) => id !== "p02"));
});

test("collectPage: ardışık sayfalar tekrarsız ve eksiksiz (kendi ürün hariç)", async () => {
  const list = ids(37);
  let items = [];
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const p = await collectPage(list, "p10", cursor, 8, fetcherOf());
    items = mergeUnique(items, p.items);
    cursor = p.cursor;
    hasMore = p.hasMore;
  }
  assert.deepEqual(items.map((i) => i.id), list.filter((id) => id !== "p10"));
});

test("mergeUnique: kimliğe göre tekrar eler, ilk görülen kalır", () => {
  const out = mergeUnique([{ id: "a", v: 1 }, { id: "b", v: 1 }], [{ id: "b", v: 2 }, { id: "c", v: 2 }, { id: "c", v: 3 }]);
  assert.deepEqual(out, [{ id: "a", v: 1 }, { id: "b", v: 1 }, { id: "c", v: 2 }]);
});

test("nearEnd: eşik en az 200 px, yarım görünüm genişliği", () => {
  assert.equal(nearEnd(0, 400, 3000), false);
  assert.equal(nearEnd(2400, 400, 3000), true);
  assert.equal(nearEnd(2300, 400, 3000), false);
  assert.equal(nearEnd(0, 1200, 1700), true);
  assert.equal(nearEnd(0, 400, 400), true);
});
