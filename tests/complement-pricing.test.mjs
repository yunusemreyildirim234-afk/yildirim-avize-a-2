import test from "node:test";
import assert from "node:assert/strict";

const { bestComplement, complementUnitDiscount, groupComplementRules, validComplementRule } = await import("../lib/complement-pricing.ts");

const pct = (mainProductId, value) => ({ mainProductId, type: "PERCENT", value });
const fix = (mainProductId, value) => ({ mainProductId, type: "FIXED", value });
const present = (...ids) => new Set(ids);

test("yüzde ve TL birim indirimi, 2 ondalığa yuvarlanır", () => {
  assert.equal(complementUnitDiscount(pct("a", 10), 200), 20);
  assert.equal(complementUnitDiscount(pct("a", 15), 33.33), 5);
  assert.equal(complementUnitDiscount(pct("a", 7), 19.99), 1.4);
  assert.equal(complementUnitDiscount(fix("a", 12.5), 200), 12.5);
});

test("ana ürün sepette yoksa indirim yok; varsa var", () => {
  assert.equal(bestComplement([pct("a", 10)], present("x"), 100), null);
  assert.equal(bestComplement([pct("a", 10)], present(), 100), null);
  assert.deepEqual(bestComplement([pct("a", 10)], present("a"), 100), { mainProductId: "a", unitDiscount: 10 });
});

test("kural listesi boş/null: indirim yok", () => {
  assert.equal(bestComplement([], present("a"), 100), null);
  assert.equal(bestComplement(null, present("a"), 100), null);
  assert.equal(bestComplement(undefined, present("a"), 100), null);
});

test("birden fazla ana ürün: en büyük birim indirim, toplanmaz", () => {
  const r = bestComplement([pct("a", 10), fix("b", 30), pct("c", 5)], present("a", "b", "c"), 100);
  assert.deepEqual(r, { mainProductId: "b", unitDiscount: 30 });
  // yalnız sepette olanlar aday
  assert.deepEqual(bestComplement([pct("a", 10), fix("b", 30)], present("a"), 100), { mainProductId: "a", unitDiscount: 10 });
});

test("eşitlikte küçük mainProductId seçilir", () => {
  const r = bestComplement([fix("zz", 10), fix("aa", 10), pct("mm", 10)], present("zz", "aa", "mm"), 100);
  assert.deepEqual(r, { mainProductId: "aa", unitDiscount: 10 });
});

test("birim indirim ≥ fiyat ise bağ yok sayılır (fiyat 0'a inmez); küçük bağa düşer", () => {
  assert.equal(bestComplement([fix("a", 100)], present("a"), 100), null);
  assert.equal(bestComplement([fix("a", 150)], present("a"), 100), null);
  assert.deepEqual(bestComplement([fix("a", 150), pct("b", 10)], present("a", "b"), 100), { mainProductId: "b", unitDiscount: 10 });
  // yuvarlayınca 0 olan indirim de yok sayılır
  assert.equal(bestComplement([pct("a", 0.01)], present("a"), 1), null);
});

test("geçersiz kurallar yok sayılır", () => {
  for (const bad of [pct("a", 0), pct("a", -5), pct("a", 100), pct("a", 150), fix("a", NaN), fix("a", Infinity), { mainProductId: "a", type: "X", value: 5 }, { mainProductId: "", type: "FIXED", value: 5 }, { mainProductId: "a", type: "FIXED", value: "5" }]) {
    assert.equal(validComplementRule(bad), false);
    assert.equal(bestComplement([bad], present("a", ""), 100), null);
  }
});

test("groupComplementRules: tamamlayıcıya göre gruplar, geçersiz satırı atar", () => {
  const map = groupComplementRules([
    { mainProductId: "a", complementProductId: "c1", discountType: "PERCENT", discountValue: 10 },
    { mainProductId: "b", complementProductId: "c1", discountType: "FIXED", discountValue: 25 },
    { mainProductId: "a", complementProductId: "c2", discountType: "PERCENT", discountValue: 100 },
    { mainProductId: "a", complementProductId: "c3", discountType: "BOGUS", discountValue: 5 },
  ]);
  assert.deepEqual(map.get("c1"), [pct("a", 10), fix("b", 25)]);
  assert.equal(map.has("c2"), false);
  assert.equal(map.has("c3"), false);
});
