import test from "node:test";
import assert from "node:assert/strict";
import { applyListing, parseListingParams, normalizeEbat, parseSize, variationAttrs, SORTS, SORT_LABELS } from "../lib/listing-core.ts";

const CATS = [{ key: "kristal", slug: "kristal", title: "Kristal" }];
const sz = (v) => variationAttrs("Seçenek", `Siyah / ${v}`);
const row = (id, o = {}) => ({ id, cat: "kristal", price: 100, created: 1, updated: 1, featured: false, vars: [], own: null, ...o });
const run = (rows, q = {}) => applyListing(rows, parseListingParams(q), { cats: CATS });

test("normalizeEbat: geçerli girişler tek biçime çevrilir", () => {
  for (const [i, o] of [["45x25", "45 x 25"], ["45 X 25", "45 x 25"], ["45 × 25", "45 x 25"], [" 12,5 x 10 ", "12,5 x 10"], ["12.5x10", "12,5 x 10"], ["100x20", "100 x 20"]]) {
    assert.deepEqual(normalizeEbat(i), { ok: true, value: o }, i);
  }
});
test("normalizeEbat: boş = temizle; kalıba uymayanlar ve uzun giriş reddedilir", () => {
  assert.deepEqual(normalizeEbat(""), { ok: true, value: null });
  assert.deepEqual(normalizeEbat("   "), { ok: true, value: null });
  assert.deepEqual(normalizeEbat(null), { ok: true, value: null });
  for (const bad of ["E27", "45", "45 cm", "45 x 25 x 10", "45 x", "0 x 5", "45 x 25 cm", "abc x def", "1".repeat(25), 45]) {
    const r = normalizeEbat(bad);
    assert.equal(r.ok, false, String(bad));
    assert.match(r.error, /Ebat/);
  }
});

test("sıralama seçenekleri ve etiketleri", () => {
  assert.ok(SORTS.includes("ebat-artan") && SORTS.includes("ebat-azalan"));
  assert.equal(SORT_LABELS["ebat-artan"], "Ebat: Küçükten büyüğe");
  assert.equal(SORT_LABELS["ebat-azalan"], "Ebat: Büyükten küçüğe");
  assert.equal(parseListingParams({ siralama: "ebat-artan" }).siralama, "ebat-artan");
  assert.equal(parseListingParams({ siralama: "ebat-yok" }).siralama, "onerilen");
});

const SORT_ROWS = [
  row("a", { own: parseSize("100 x 20") }), // anahtar (100,20)
  row("b", { own: parseSize("9 x 14") }), // (14,9)
  row("c"), // ebatsız
  row("d", { vars: [sz("40 x 60"), sz("30 x 30")] }), // (60,40) ve (30,30): çok ebatlı
  row("e", { own: parseSize("14 x 9") }), // (14,9): b ile eşit → id
  row("f", { own: parseSize("50 x 50"), vars: [sz("20 x 70")] }), // (50,50) ve (70,20)
  row("g"), // ebatsız
];
test("ebat sıralaması: sayısal (9 x 14 < 100 x 20), artanda en küçük, azalanda en büyük anahtar", () => {
  assert.deepEqual(run(SORT_ROWS, { siralama: "ebat-artan" }).ids, ["b", "e", "d", "f", "a", "c", "g"]);
  assert.deepEqual(run(SORT_ROWS, { siralama: "ebat-azalan" }).ids, ["a", "f", "d", "b", "e", "c", "g"]);
});
test("ebat sıralaması: ebatsızlar iki yönde de sonda; eşitlikte id ile kararlı; girdi sırasından bağımsız", () => {
  for (const s of ["ebat-artan", "ebat-azalan"]) {
    const ids = run(SORT_ROWS, { siralama: s }).ids;
    assert.deepEqual(ids.slice(-2), ["c", "g"]);
    assert.deepEqual(run([...SORT_ROWS].reverse(), { siralama: s }).ids, ids);
  }
});
test("ebat sıralaması: artanda en küçük anahtar iki yönde monoton", () => {
  const key = (id) => {
    const r = SORT_ROWS.find((x) => x.id === id);
    return [...r.vars.flatMap((v) => (v.s ? [v.s.k] : [])), ...(r.own ? [r.own.k] : [])].map((k) => k.split("x").map(Number).sort((p, q) => q - p));
  };
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1];
  const withSize = (ids) => ids.filter((i) => key(i).length);
  const asc = withSize(run(SORT_ROWS, { siralama: "ebat-artan" }).ids).map((i) => key(i).sort(cmp)[0]);
  const desc = withSize(run(SORT_ROWS, { siralama: "ebat-azalan" }).ids).map((i) => key(i).sort(cmp).at(-1));
  for (let i = 1; i < asc.length; i++) assert.ok(cmp(asc[i - 1], asc[i]) <= 0);
  for (let i = 1; i < desc.length; i++) assert.ok(cmp(desc[i - 1], desc[i]) >= 0);
});

test("filtre: ebatı olan ama rengi olmayan ürün ebat filtresinde ve facette görünür", () => {
  const rows = [row("x", { own: parseSize("45 x 25") }), row("y", { vars: [sz("45 x 25")] }), row("z", { own: parseSize("30 x 30") })];
  const r = run(rows, { ebat: "45x25" });
  assert.deepEqual([...r.ids].sort(), ["x", "y"]);
  const f = r.facets.sizes.find((s) => s.key === "45x25");
  assert.equal(f.count, 2);
  assert.equal(f.name, "45 x 25");
  assert.equal(r.facets.sizes.find((s) => s.key === "30x30").count, 1);
});
test("filtre: ürün ebadı varyasyon ebadıyla birleşir; aynı ebat bir ürünü iki kez saymaz", () => {
  const rows = [row("p", { own: parseSize("45 x 25"), vars: [sz("45 x 25"), sz("30 x 30")] })];
  const r = run(rows);
  assert.equal(r.facets.sizes.find((s) => s.key === "45x25").count, 1);
  assert.equal(r.facets.sizes.find((s) => s.key === "30x30").count, 1);
});
test("filtre: renk + ürün düzeyi ebat; ürün ebadı her renk varyasyonuyla eşleşir, varyasyon ebatı aynı varyasyon kuralını korur", () => {
  const sil = (c, s) => variationAttrs("Seçenek", `${c} / ${s}`);
  const rows = [
    row("own", { own: parseSize("45 x 25"), vars: [variationAttrs("Renk", "Gold"), variationAttrs("Renk", "Siyah")] }),
    row("var", { vars: [sil("Gold", "45 x 25"), sil("Siyah", "30 x 30")] }),
    row("ownNoColor", { own: parseSize("45 x 25") }),
  ];
  assert.deepEqual([...run(rows, { renk: "gold", ebat: "45x25" }).ids].sort(), ["own", "var"]);
  assert.deepEqual([...run(rows, { renk: "siyah", ebat: "45x25" }).ids].sort(), ["own"]); // var: siyah varyasyonu 30x30
  assert.deepEqual([...run(rows, { ebat: "45x25" }).ids].sort(), ["own", "ownNoColor", "var"]);
  const f = run(rows, { renk: "siyah" });
  assert.equal(f.facets.sizes.find((s) => s.key === "45x25").count, 1); // yalnızca "own" (rengi olmayan ürün siyahla eşleşmez)
  assert.equal(f.facets.sizes.find((s) => s.key === "30x30").count, 1);
  const g = run(rows, { ebat: "45x25" });
  assert.equal(g.facets.colors.find((c) => c.key === "siyah").count, 1); // "own" (ürün ebadı) ; "var" siyahı 30x30
  assert.equal(g.facets.colors.find((c) => c.key === "gold").count, 2);
});
test("filtre: evrende olmayan ebat atılır; ürün ebadı evrene girer", () => {
  assert.deepEqual(run([row("a")], { ebat: "45x25" }).state.ebatlar, []);
  assert.deepEqual(run([row("a", { own: parseSize("45 x 25") })], { ebat: "45x25" }).state.ebatlar, ["45x25"]);
});
