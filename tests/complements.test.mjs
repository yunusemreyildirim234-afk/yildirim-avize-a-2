import test from "node:test";
import assert from "node:assert/strict";

const m = await import("../lib/complements.ts");

test("sabitler plana uygun", () => {
  assert.equal(m.DEFAULT_SUGGEST_COUNT, 4);
  assert.equal(m.MAX_SUGGEST_COUNT, 12);
  assert.equal(m.MAX_COMPLEMENTS_PER_MAIN, 12);
});

test("parseSuggestCount: sınır değerleri (CHECK 0-12 ile aynı)", () => {
  for (const [input, value] of [[0, 0], [4, 4], [12, 12], ["7", 7], [" 3 ", 3], [null, null], [undefined, null], ["", null], ["  ", null]]) {
    assert.deepEqual(m.parseSuggestCount(input), { ok: true, value }, String(input));
  }
  for (const bad of [-1, 13, 2.5, "x", "2.5", "-1", "13", NaN, Infinity, true, {}, []]) {
    const r = m.parseSuggestCount(bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.error, "Öneri sayısı 0 ile 12 arasında bir tam sayı olmalıdır (boş: 4).");
  }
});

test("resolveSuggestCount: NULL → 4, 0 → kapalı, 12 üst sınır", () => {
  assert.equal(m.resolveSuggestCount(null), 4);
  assert.equal(m.resolveSuggestCount(undefined), 4);
  assert.equal(m.resolveSuggestCount(0), 0);
  assert.equal(m.resolveSuggestCount(7), 7);
  assert.equal(m.resolveSuggestCount(12), 12);
  assert.equal(m.resolveSuggestCount(99), 12);
  assert.equal(m.resolveSuggestCount(-3), 4);
});

test("validateComplementDiscount", () => {
  assert.equal(m.validateComplementDiscount("PERCENT", 10), null);
  assert.equal(m.validateComplementDiscount("FIXED", 12.5), null);
  assert.equal(m.validateComplementDiscount("PERCENT", 0), "İndirim 0'dan büyük olmalıdır.");
  assert.equal(m.validateComplementDiscount("FIXED", -1), "İndirim 0'dan büyük olmalıdır.");
  assert.equal(m.validateComplementDiscount("FIXED", "5"), "İndirim 0'dan büyük olmalıdır.");
  assert.equal(m.validateComplementDiscount("PERCENT", 100), "Yüzde 100'ün altında olmalıdır.");
  assert.equal(m.validateComplementDiscount("FIXED", 1.234) !== null, true);
  assert.equal(m.validateComplementDiscount("X", 5) !== null, true);
  assert.equal(m.fixedDiscountFits(99.99, 100), true);
  assert.equal(m.fixedDiscountFits(100, 100), false);
});

const c = (productId, over = {}) => ({ productId, active: true, purchasable: true, inStock: true, position: 0, createdAt: 0, ...over });

test("pickSuggestions: sepettekiler gizlenir ve sayıya girmez; sıradaki yerini alır", () => {
  const cands = [c("a", { position: 0 }), c("b", { position: 1 }), c("c", { position: 2 }), c("d", { position: 3 }), c("e", { position: 4 })];
  assert.deepEqual(m.pickSuggestions(cands, new Set(["a"]), null).map((x) => x.productId), ["b", "c", "d", "e"]);
  assert.deepEqual(m.pickSuggestions(cands, new Set(), 2).map((x) => x.productId), ["a", "b"]);
  assert.deepEqual(m.pickSuggestions(cands, new Set(["a", "b"]), 2).map((x) => x.productId), ["c", "d"]);
});

test("pickSuggestions: ayar 0 boş, 12 üst sınır, pasif/stoksuz/fiyatsız elenir, position sonra eklenme sırası", () => {
  const cands = [c("a", { active: false }), c("b", { inStock: false }), c("c", { purchasable: false }), c("d", { position: 1, createdAt: 5 }), c("e", { position: 1, createdAt: 2 }), c("f", { position: 0, createdAt: 9 })];
  assert.deepEqual(m.pickSuggestions(cands, new Set(), 0), []);
  assert.deepEqual(m.pickSuggestions(cands, new Set(), null).map((x) => x.productId), ["f", "e", "d"]);
  const many = Array.from({ length: 20 }, (_, i) => c(`p${i}`, { position: i }));
  assert.equal(m.pickSuggestions(many, new Set(), 12).length, 12);
  assert.equal(m.pickSuggestions(many, new Set(), 50).length, 12);
});

// ---- buildSuggestions / suggestionPrice (P24) ----
const v = (id, over = {}) => ({ id, variationType: "Renk", variationValue: id, extraPrice: 0, stock: 5, ...over });
const row = (mainProductId, cid, over = {}, cover = {}) => ({
  mainProductId, discountType: "PERCENT", discountValue: 10, position: 0, createdAt: 0,
  complement: { id: cid, title: `Ürün ${cid}`, active: true, basePrice: 100, listPrice: null, imageUrl: null, images: [], bulkTiers: null, couponAllowed: true, pickupDiscountPct: null, transferDiscountPct: null, variations: [v(`${cid}-v1`)], ...cover },
  ...over,
});

test("buildSuggestions: bağ yoksa boş (uyku hâli)", () => {
  assert.deepEqual(m.buildSuggestions([], new Set(), null), []);
});

test("buildSuggestions: sepetteki ürün (hangi varyasyon olursa olsun) gizlenir, sıradaki yerini alır; ayar 0 → boş", () => {
  const rows = ["a", "b", "c", "d", "e"].map((id, i) => row("main", id, { position: i }));
  assert.deepEqual(m.buildSuggestions(rows, new Set(["a"]), null).map((s) => s.productId), ["b", "c", "d", "e"]);
  assert.deepEqual(m.buildSuggestions(rows, new Set(["a", "b"]), 2).map((s) => s.productId), ["c", "d"]);
  assert.deepEqual(m.buildSuggestions(rows, new Set(), 0), []);
  assert.equal(m.buildSuggestions(rows, new Set(), 12).length, 5);
});

test("buildSuggestions: pasif, stoksuz, fiyatsız elenir; position sonra eklenme sırası", () => {
  const rows = [
    row("main", "pasif", {}, { active: false }),
    row("main", "stoksuz", {}, { variations: [v("s1", { stock: 0 })] }),
    row("main", "fiyatsiz", {}, { basePrice: 0 }),
    row("main", "d", { position: 1, createdAt: 5 }),
    row("main", "e", { position: 1, createdAt: 2 }),
    row("main", "f", { position: 0, createdAt: 9 }),
  ];
  assert.deepEqual(m.buildSuggestions(rows, new Set(), null).map((s) => s.productId), ["f", "e", "d"]);
});

test("buildSuggestions: aynı tamamlayıcı iki ana ürüne bağlıysa tek kart, kurallar birleşir; geçersiz kural atılır", () => {
  const rows = [row("m1", "x", { position: 3 }), row("m2", "x", { position: 1, discountValue: 20 }), row("m3", "x", { discountValue: 150 })];
  const out = m.buildSuggestions(rows, new Set(), null);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].rules.map((r) => r.mainProductId), ["m1", "m2"]);
});

test("buildSuggestions: yalnız gerekli alanlar gider; liste fiyatı yalnız tabandan yüksekse", () => {
  const out = m.buildSuggestions([row("m", "x", {}, { listPrice: 150, images: ["/a.jpg"] })], new Set(), null)[0];
  assert.equal(out.listPrice, 150);
  assert.equal(out.imageUrl, "/a.jpg");
  assert.equal("description" in out, false);
  assert.equal(m.buildSuggestions([row("m", "y", {}, { listPrice: 90 })], new Set(), null)[0].listPrice, null);
});

test("suggestionPrice: yüzde ve TL indirimi; varsayılan seçenek stoklu en ucuz ek fiyatlı", () => {
  const s = m.buildSuggestions([row("m", "x")], new Set(), null)[0];
  assert.deepEqual(m.suggestionPrice(s, 0), { regular: 100, unit: 90, discount: 10 });
  const t = m.buildSuggestions([row("m", "z", { discountType: "FIXED", discountValue: 15 })], new Set(), null)[0];
  assert.deepEqual(m.suggestionPrice(t, 50), { regular: 150, unit: 135, discount: 15 });
  const multi = { variations: [v("a", { stock: 0, extraPrice: 0 }), v("b", { extraPrice: 20 }), v("c", { extraPrice: 5 })] };
  assert.equal(m.defaultSuggestionVariation(multi).id, "c");
});
