import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const route = await import("../app/api/cart/complements/route.ts");
const lib = await import("../lib/complements.ts");

let calls;
function setup(rows = [], cfg = null) {
  calls = { complements: [], config: 0 };
  globalThis.__fakePrisma = {
    productComplement: { findMany: async (a) => (calls.complements.push(a), rows) },
    siteConfig: { findUnique: async () => (calls.config++, { complementSuggestCount: cfg }) },
  };
}
const dbRow = (main, cid, over = {}) => ({
  mainProductId: main, discountType: "PERCENT", discountValue: 10, position: 0, createdAt: new Date(0),
  complementProduct: { id: cid, title: `T ${cid}`, active: true, basePrice: 100, listPrice: null, imageUrl: null, images: [], bulkTiers: null, couponAllowed: true, pickupDiscountPct: null, transferDiscountPct: null, variations: [{ id: `${cid}v`, variationType: "Renk", variationValue: "Gold", extraPrice: 0, stock: 3, images: [] }] },
  ...over,
});
const get = (q) => route.GET(new Request(`http://x/api/cart/complements${q}`, { headers: { "x-forwarded-for": `ip-${Math.random()}` } }));

test("kimlik doğrulama: bozuk biçim ve 50 üstü 400, DB'ye gidilmez", async () => {
  setup();
  assert.equal((await get("?ids=a%20b")).status, 400);
  assert.equal((await get("?ids=a,%27;drop")).status, 400);
  assert.equal((await get(`?ids=${Array.from({ length: 51 }, (_, i) => `p${i}`).join(",")}`)).status, 400);
  assert.equal(calls.complements.length, 0);
  assert.equal(lib.parseCartProductIds("b,a,b")?.join(), "a,b");
});

test("kimlik yok: boş liste, DB sorgusu yok", async () => {
  setup();
  const res = await get("");
  assert.deepEqual(await res.json(), { suggestions: [] });
  assert.equal(calls.complements.length + calls.config, 0);
});

test("bağ yok (uyku): tek sorgu, ayar sorgusu atılmaz, boş liste", async () => {
  setup([]);
  const res = await get("?ids=m1");
  assert.deepEqual(await res.json(), { suggestions: [] });
  assert.equal(calls.complements.length, 1);
  assert.equal(calls.config, 0);
});

test("salt okunur tek sorgu, yalnız gerekli select, önbellek başlığı; sepetteki ürün gizlenir", async () => {
  setup([dbRow("m1", "a"), dbRow("m1", "b", { position: 1 }), dbRow("m1", "c", { position: 2 })], null);
  const res = await get("?ids=m1,b");
  const body = await res.json();
  assert.deepEqual(body.suggestions.map((s) => s.productId), ["a", "c"]);
  assert.equal(calls.complements.length, 1);
  assert.equal(calls.config, 1);
  assert.deepEqual(calls.complements[0].where, { mainProductId: { in: ["b", "m1"] } });
  assert.equal("description" in calls.complements[0].select.complementProduct.select, false);
  assert.match(res.headers.get("Cache-Control"), /s-maxage=60/);
  assert.equal(JSON.stringify(body).includes("images"), false);
});

test("kart sayısı ayardan: 1 ve 0", async () => {
  setup([dbRow("m1", "a"), dbRow("m1", "b", { position: 1 })], 1);
  assert.equal((await (await get("?ids=m1")).json()).suggestions.length, 1);
  setup([dbRow("m1", "a")], 0);
  assert.deepEqual((await (await get("?ids=m1")).json()).suggestions, []);
});

test("hız sınırı: aynı IP 60 istekten sonra 429", async () => {
  setup([]);
  const mk = () => route.GET(new Request("http://x/api/cart/complements?ids=m1", { headers: { "x-forwarded-for": "same-ip" } }));
  let last;
  for (let i = 0; i < 61; i++) last = await mk();
  assert.equal(last.status, 429);
});
