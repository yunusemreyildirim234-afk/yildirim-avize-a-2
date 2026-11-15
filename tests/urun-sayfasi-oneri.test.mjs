import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const { getProductComplements } = await import("../lib/complement-suggestions.ts");
const { visibleSuggestions } = await import("../lib/complements.ts");

let q;
const prod = (id) => ({ id, title: id, active: true, basePrice: 100, listPrice: null, imageUrl: null, images: [], bulkTiers: null, couponAllowed: true, pickupDiscountPct: null, transferDiscountPct: null, variations: [{ id: `${id}v`, variationType: "Renk", variationValue: "A", extraPrice: 0, stock: 2, images: [] }] });
const row = (cid, position = 0) => ({ mainProductId: "main", discountType: "PERCENT", discountValue: 10, position, createdAt: new Date(0), complementProduct: prod(cid) });
function setup(rows, count = null) {
  q = { complements: 0, config: 0 };
  globalThis.__fakePrisma = {
    productComplement: { findMany: async () => (q.complements++, rows) },
    siteConfig: { findUnique: async () => (q.config++, { complementSuggestCount: count }) },
  };
}

test("bağ yok (uyku): ürün sayfası için boş sonuç, yalnız 1 sorgu (ayar okunmaz)", async () => {
  setup([]);
  assert.deepEqual(await getProductComplements("main"), { suggestions: [], count: null });
  assert.deepEqual([q.complements, q.config], [1, 0]);
});

test("ürün sayfası: kendi ürünü gizli, üst sınır kadar sıralı aday gelir; sepettekiler istemcide süzülür ve sayıya girmez", async () => {
  setup([row("main"), row("a", 0), row("b", 1), row("c", 2), row("d", 3), row("e", 4)], 4);
  const { suggestions, count } = await getProductComplements("main");
  assert.deepEqual(suggestions.map((s) => s.productId), ["a", "b", "c", "d", "e"]);
  assert.equal(count, 4);
  assert.deepEqual(visibleSuggestions(suggestions, new Set(["a"]), count).map((s) => s.productId), ["b", "c", "d", "e"]);
  assert.deepEqual([q.complements, q.config], [1, 1]);
});

test("ayar 0: ürün sayfasında bölüm yok", async () => {
  setup([row("a")], 0);
  assert.deepEqual((await getProductComplements("main")).suggestions, []);
});
