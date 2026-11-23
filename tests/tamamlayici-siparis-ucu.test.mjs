import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./_route-hooks.mjs", import.meta.url);

// Gerçek /api/order ve /api/cart/quote kodu; yalnız veritabanı ve dış servisler sahte.
const order = await import("../app/api/order/route.ts");
const quote = await import("../app/api/cart/quote/route.ts");

// Ürünler: ana avize (p-main, 1000 ₺), ampul (p-bulb, 100 ₺)
const product = (id, basePrice, over = {}) => ({ id, title: id, active: true, basePrice, bulkTiers: null, couponAllowed: true, pickupDiscountPct: null, transferDiscountPct: null, ...over });
const VARS = {
  "v-main": { id: "v-main", productId: "p-main", variationValue: "Gold", extraPrice: 0, stock: 10, product: product("p-main", 1000) },
  "v-bulb": { id: "v-bulb", productId: "p-bulb", variationValue: "E14", extraPrice: 0, stock: 50, product: product("p-bulb", 100) },
};
let calls;
let ipN = 0;
function useDb(links) {
  calls = { complementFind: [], orderData: null };
  globalThis.__fakePrisma = {
    productVariation: {
      findUnique: async ({ where }) => VARS[where.id] ?? null,
      findMany: async ({ where }) => where.id.in.map((id) => VARS[id]).filter(Boolean),
    },
    siteConfig: { findUnique: async () => null },
    productComplement: {
      findMany: async (args) => {
        calls.complementFind.push(args);
        const { mainProductId, complementProductId } = args.where;
        return links.filter((l) => mainProductId.in.includes(l.mainProductId) && complementProductId.in.includes(l.complementProductId));
      },
    },
    user: { findUnique: async () => null, findFirst: async () => ({ id: "u1", password: "guest_checkout" }), create: async () => ({ id: "u1" }) },
    $transaction: async (fn) =>
      fn({
        $executeRaw: async () => 1,
        order: { create: async ({ data }) => ((calls.orderData = data), { id: "o1" }) },
      }),
  };
}
const link = { mainProductId: "p-main", complementProductId: "p-bulb", discountType: "PERCENT", discountValue: 10 };
const post = (route, body) =>
  route.POST(new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipN}` }, body: JSON.stringify(body) }));
const orderBody = (items, extra = {}) => ({
  name: "Test Müşteri", email: "t@example.invalid", phone: "05551112233", address: "Test mah. test sok. no 1", buyerStateId: 34, buyerCityId: 425, buyerStateName: "İSTANBUL", buyerCityName: "BEYOĞLU",
  shippingType: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER", consent: true, items, ...extra,
});
const both = [{ variationId: "v-main", quantity: 1 }, { variationId: "v-bulb", quantity: 6 }];

test("sipariş: bağ + ana ürün sepette → 1 adet indirimli + kalan normal kalem, bundle alanları dolu; toplam teklifle aynı", async () => {
  useDb([link]);
  const res = await post(order, orderBody(both));
  assert.equal(res.status, 200);
  const items = calls.orderData.items.create;
  // 6 adet ampul: 1 adet indirimli kalem + 5 adet normal kalem (her kalemde unitPrice × quantity doğru)
  const bulbRows = items.filter((i) => i.variationId === "v-bulb");
  const main = items.find((i) => i.variationId === "v-main");
  assert.deepEqual(bulbRows.map((r) => [r.quantity, r.unitPrice, r.bundleMainProductId, r.bundleDiscount]), [[1, 90, "p-main", 10], [5, 100, null, null]]);
  assert.equal(main.unitPrice, 1000);
  assert.equal(main.bundleMainProductId, null);
  assert.equal(main.bundleDiscount, null);
  // sorgu yalnızca sepetteki ürünlerle sınırlı
  assert.deepEqual(calls.complementFind[0].where, { mainProductId: { in: ["p-main", "p-bulb"] }, complementProductId: { in: ["p-main", "p-bulb"] } });
  // teklif ucuyla aynı toplam (havale %5 dahil)
  const q = await (await post(quote, { items: [{ variationId: "v-main", qty: 1 }, { variationId: "v-bulb", qty: 6 }], paymentMethod: "BANK_TRANSFER" })).json();
  assert.equal(calls.orderData.totalAmount, q.totals.total);
  assert.equal(q.totals.itemsTotal, 1590);
  assert.equal(q.lines[1].unitPrice, 100);
  assert.equal(q.lines[1].lineTotal, 590);
  assert.deepEqual(q.lines[1].bundles, [{ mainProductId: "p-main", unitDiscount: 10, qty: 1, total: 10 }]);
  // saklanan kalemlerin toplamı = sepet/teklif ürün toplamı (PayTR sepeti aynı kalemlerden kurulur)
  assert.equal(items.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0), q.totals.itemsTotal);
  assert.deepEqual(q.lines[0].bundles, []);
});

test("sipariş: bağ yok → indirim yok, alanlar null (dormant: davranış aynı)", async () => {
  useDb([]);
  const res = await post(order, orderBody(both));
  assert.equal(res.status, 200);
  for (const i of calls.orderData.items.create) {
    assert.equal(i.bundleMainProductId, null);
    assert.equal(i.bundleDiscount, null);
  }
  assert.equal(calls.orderData.items.create.find((i) => i.variationId === "v-bulb").unitPrice, 100);
  assert.equal(calls.orderData.totalAmount, 1600 - Math.round(1600 * 0.05));
});

test("sipariş: ana ürün sepette yokken indirim yok; tek ürünlü sepette bağ sorgusu atılmaz", async () => {
  useDb([link]);
  const res = await post(order, orderBody([{ variationId: "v-bulb", quantity: 6 }]));
  assert.equal(res.status, 200);
  const [row] = calls.orderData.items.create;
  assert.equal(row.unitPrice, 100);
  assert.equal(row.bundleMainProductId, null);
  assert.equal(calls.complementFind.length, 0);
});

test("sipariş ve teklif: istemci gövdesindeki sahte complementOf / bundle alanları YOK SAYILIR", async () => {
  useDb([]); // gerçekte bağ yok
  const fake = [{ mainProductId: "p-main", type: "PERCENT", value: 90 }];
  const res = await post(
    order,
    orderBody(
      [{ variationId: "v-main", quantity: 1, complementOf: fake, bundleDiscount: 999 }, { variationId: "v-bulb", quantity: 6, complementOf: fake, bundle: { mainProductId: "p-main", total: 540 }, unitPrice: 1 }],
      { complementOf: fake, rules: { complementOf: fake } }
    )
  );
  assert.equal(res.status, 200);
  const bulb = calls.orderData.items.create.find((i) => i.variationId === "v-bulb");
  assert.equal(bulb.unitPrice, 100);
  assert.equal(bulb.bundleMainProductId, null);
  assert.equal(bulb.bundleDiscount, null);
  const q = await (await post(quote, { items: [{ variationId: "v-main", qty: 1, complementOf: fake }, { variationId: "v-bulb", qty: 6, complementOf: fake, rules: { complementOf: fake } }], complementOf: fake })).json();
  assert.equal(q.lines[1].unitPrice, 100);
  assert.deepEqual(q.lines[1].rules.complementOf, []);
});

test("kaynak: complementOf yalnızca DB kurallarından gelir; teklif ucu salt okunur kalır", () => {
  for (const f of ["../app/api/order/route.ts", "../app/api/cart/quote/route.ts"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const uses = src.split("\n").map((ln) => ln.split("//")[0]).filter((ln) => ln.includes("complementOf"));
    assert.ok(uses.length > 0);
    for (const u of uses) assert.ok(/complementRules\.get\(|l\.complementOf/.test(u), u);
    assert.ok(!/(body|item|raw|req)[\w.?]*\.complementOf/.test(src), "istemci verisinden complementOf okunamaz");
  }
  const q = readFileSync(new URL("../app/api/cart/quote/route.ts", import.meta.url), "utf8");
  assert.ok(!/\.(update|updateMany|create|createMany|delete|deleteMany|upsert)\(/.test(q));
});

// ---------- ANA ÜRÜN ADEDİ KURALI (çok gruplu bölme): sepet = sipariş kalemleri = PayTR sepeti, kuruşu kuruşuna ----------
for (const [id, price] of [["small", 1000], ["big", 1000], ["tiny", 1000]]) VARS[`v-${id}`] = { id: `v-${id}`, productId: `p-${id}`, variationValue: "Gold", extraPrice: 0, stock: 100, product: product(`p-${id}`, price) };
const multiLinks = [
  { mainProductId: "p-small", complementProductId: "p-bulb", discountType: "PERCENT", discountValue: 12 },
  { mainProductId: "p-big", complementProductId: "p-bulb", discountType: "PERCENT", discountValue: 16 },
  { mainProductId: "p-tiny", complementProductId: "p-bulb", discountType: "FIXED", discountValue: 5.55 },
];
const cents = (x) => Math.round(x * 100);

test("sipariş: 10 küçük + 1 büyük + 1 tiny + 14 ampul → 4 kalem; kalem, teklif ve PayTR sepeti toplamı kuruşu kuruşuna eşit", async () => {
  useDb(multiLinks);
  const items = [{ variationId: "v-small", quantity: 10 }, { variationId: "v-big", quantity: 1 }, { variationId: "v-tiny", quantity: 1 }, { variationId: "v-bulb", quantity: 14 }];
  globalThis.__lastPaytr = null;
  const res = await post(order, orderBody(items, { paymentMethod: "CREDIT_CARD" }));
  assert.equal(res.status, 200);
  const rows = calls.orderData.items.create;
  const bulb = rows.filter((r) => r.variationId === "v-bulb");
  assert.deepEqual(bulb.map((r) => [r.quantity, r.unitPrice, r.bundleMainProductId, r.bundleDiscount]), [[1, 84, "p-big", 16], [10, 88, "p-small", 120], [1, 94.45, "p-tiny", 5.55], [2, 100, null, null]]);
  assert.equal(bulb.length, 4); // 3 kullanılan ana ürün + 1 normal
  const q = await (await post(quote, { items: items.map((i) => ({ variationId: i.variationId, qty: i.quantity })), paymentMethod: "CREDIT_CARD" })).json();
  const orderSum = rows.reduce((s, r) => s + cents(r.unitPrice * r.quantity), 0);
  assert.equal(orderSum, cents(q.totals.itemsTotal));
  assert.equal(q.lines[3].lineTotal, 84 + 880 + 94.45 + 200);
  assert.deepEqual(q.lines[3].bundles.map((g) => [g.mainProductId, g.qty, g.total]), [["p-big", 1, 16], ["p-small", 10, 120], ["p-tiny", 1, 5.55]]);
  const paytr = globalThis.__lastPaytr;
  const basketSum = paytr.basket.reduce((s, b) => s + cents(b.price * b.quantity), 0);
  assert.equal(basketSum, orderSum); // PayTR sepeti = sipariş kalemleri (kargo yok: 350 ₺ üstü)
  assert.equal(basketSum, cents(paytr.amountTl));
  assert.equal(cents(calls.orderData.totalAmount), cents(q.totals.total));
  assert.equal(cents(q.totals.total), orderSum);
});

test("sipariş ve teklif: istemci gövdesinden ana ürün adedi / indirim / bundles gönderilse de yok sayılır", async () => {
  useDb(multiLinks);
  const forged = { bundles: [{ mainProductId: "p-small", unitDiscount: 99, qty: 50, total: 4950 }], mainQty: { "p-small": 99 }, bundleDiscount: 999, unitPrice: 1 };
  const items = [{ variationId: "v-small", quantity: 1, ...forged }, { variationId: "v-bulb", quantity: 5, ...forged }];
  const res = await post(order, orderBody(items, { ...forged, paymentMethod: "CREDIT_CARD" }));
  assert.equal(res.status, 200);
  const bulb = calls.orderData.items.create.filter((r) => r.variationId === "v-bulb");
  assert.deepEqual(bulb.map((r) => [r.quantity, r.unitPrice, r.bundleMainProductId]), [[1, 88, "p-small"], [4, 100, null]]); // 1 ana ürün = 1 hak
  const q = await (await post(quote, { items: items.map((i) => ({ variationId: i.variationId, qty: i.quantity, ...forged })), ...forged })).json();
  assert.equal(q.lines[1].lineTotal, 88 + 400);
});
