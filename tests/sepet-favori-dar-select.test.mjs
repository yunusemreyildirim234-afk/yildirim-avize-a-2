import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { hasInclude, project, selectedLeaves } from "./_select-projection.mjs";

// DAVRANIŞ: sepet ve favori GET uçları GERÇEK kodla çalışır. Sahte depo Prisma gibi `select`'i uygular: yalnız seçilen alanlar döner.
// Kural: include yok, ağır alanlar (açıklama, Trendyol anlık görüntüsü) seçilmez; uç yanıtı yalnız seçilen alanlarla EKSİKSİZ üretir.
register("./_hooks-davranis.mjs", import.meta.url);
const cart = await import("../app/api/cart/route.ts");
const fav = await import("../app/api/favorites/route.ts");

const HEAVY = ["description", "syncSnapshot", "trendyolId", "trendyolRaw"];
const product = {
  id: "p1", title: "Kristal Avize", category: "Salon", active: true, basePrice: 1000, listPrice: 1500, imageUrl: "/eski.jpg", images: ["/g1.jpg", "/g2.jpg"],
  bulkTiers: [{ min: 3, pct: 10 }], couponAllowed: true, pickupDiscountPct: 4, transferDiscountPct: null,
  description: "ÇOK UZUN AÇIKLAMA", syncSnapshot: { x: 1 }, trendyolId: "t1", trendyolRaw: "{}",
  variations: [{ id: "v1", images: ["/r1.jpg"], position: 0 }],
};
let args;
function setup() {
  args = {};
  globalThis.__uid = "u1";
  globalThis.__fakePrisma = {
    cartItem: { findMany: async (a) => (args.cart = a, [project([{ userId: "u1", variationId: "v1", quantity: 5, createdAt: 1, variation: { id: "v1", productId: "p1", variationValue: "Gold", stock: 3, extraPrice: 100, product }, }], a.select)[0]]) },
    favorite: { findMany: async (a) => (args.fav = a, [project({ userId: "u1", productId: "p1", createdAt: 1, product }, a.select)]) },
    siteConfig: { findUnique: async () => null },
  };
}

test("sepet GET: include yok, ağır alan seçilmez; yanıt dar select ile tam ve doğru", async () => {
  setup();
  const res = await cart.GET();
  assert.equal(res.status, 200);
  assert.equal(hasInclude(args.cart), false);
  const leaves = selectedLeaves(args.cart);
  for (const h of HEAVY) assert.ok(!leaves.has(h), `${h} seçilmemeli`);
  const { items } = await res.json();
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    productId: "p1", variationId: "v1", title: "Kristal Avize", imageUrl: "/g1.jpg", variationName: "Gold", price: 1100, listPrice: 1600,
    bulk: items[0].bulk, rules: { couponAllowed: true, pickupPct: 4, transferPct: null }, quantity: 3,
  });
  assert.ok(items[0].bulk, "kademe alanı select'ten geliyor");
  assert.ok(!JSON.stringify(items).includes("AÇIKLAMA"));
});

test("sepet GET: oturum yok → boş liste, depoya gidilmez", async () => {
  setup();
  globalThis.__uid = null;
  assert.deepEqual(await (await cart.GET()).json(), { items: [], anon: true });
  assert.equal(args.cart, undefined);
});

test("favori GET: include yok, ağır alan seçilmez; kapak ve alanlar dar select'ten üretilir", async () => {
  setup();
  const res = await fav.GET();
  assert.equal(res.status, 200);
  assert.equal(hasInclude(args.fav), false);
  const leaves = selectedLeaves(args.fav);
  for (const h of HEAVY) assert.ok(!leaves.has(h), `${h} seçilmemeli`);
  assert.deepEqual((await res.json()).items, [{ id: "p1", title: "Kristal Avize", category: "Salon", basePrice: 1000, imageUrl: "/g1.jpg" }]);
});

test("favori kapak kuralı: genel fotoğraf yoksa ilk rengin fotoğrafı (select'te varyasyon görselleri var)", async () => {
  setup();
  const p = { ...product, images: [], imageUrl: null };
  globalThis.__fakePrisma.favorite.findMany = async (a) => [project({ productId: "p1", product: p }, a.select)];
  assert.equal((await (await fav.GET()).json()).items[0].imageUrl, "/r1.jpg");
});
