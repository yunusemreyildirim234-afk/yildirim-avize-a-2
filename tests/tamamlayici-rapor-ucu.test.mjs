import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const route = await import("../app/api/admin/complement-report/route.ts");

let seen, items, ipN = 0;
function setup(authed = true, rows = []) {
  globalThis.__adminAuthed = authed;
  seen = { find: [], products: [] };
  items = rows;
  globalThis.__fakePrisma = {
    orderItem: { findMany: async (a) => (seen.find.push(a), items.slice(0, a.take)) },
    product: { findMany: async (a) => (seen.products.push(a), a.where.id.in.filter((id) => id !== "gone").map((id) => ({ id, title: `Ad ${id}` }))) },
  };
}
const get = (qs = "") => route.GET(new Request(`http://x/api/admin/complement-report${qs}`, { headers: { "x-forwarded-for": `10.0.0.${++ipN}` } }));
const it = (over = {}) => ({ quantity: 1, unitPrice: 90, bundleMainProductId: "A", bundleDiscount: 10, orderId: "o1", variation: { productId: "C" }, order: { status: "DELIVERED", createdAt: new Date("2026-05-10T10:00:00Z") }, ...over });

test("oturumsuz 401, veritabanına gidilmez", async () => {
  setup(false);
  assert.equal((await get()).status, 401);
  assert.equal(seen.find.length, 0);
});

test("sorgu: yalnız bağlı kalemler, sipariş createdAt aralığı, üst sınır+1; adlar tek sorguda", async () => {
  setup(true, [it(), it({ orderId: "o2", bundleMainProductId: "gone" })]);
  const j = await (await get("?tarih=ozel&bas=2026-05-01&bit=2026-05-31")).json();
  const q = seen.find[0];
  assert.deepEqual(q.where.bundleMainProductId, { not: null });
  assert.ok(q.where.order.createdAt.gte instanceof Date && q.where.order.createdAt.lt instanceof Date);
  assert.equal(q.take, 5001);
  assert.equal(seen.products.length, 1);
  assert.equal(j.names.A, "Ad A");
  assert.equal(j.names.gone, undefined); // silinmiş ana ürün: ad yok, arayüz "Silinmiş ürün" yazar
  assert.equal(j.report.summary.orders, 2);
  assert.equal(j.truncated, false);
});

test("tarih süzgeci yoksa tüm zaman; iptal/iade hariç sayısı döner", async () => {
  setup(true, [it(), it({ orderId: "o2", order: { status: "RETURNED", createdAt: new Date() } })]);
  const j = await (await get()).json();
  assert.equal(seen.find[0].where.order, undefined);
  assert.equal(j.report.summary.orders, 1);
  assert.equal(j.report.excludedOrders, 1);
});

test("5000 üstü: kesilir ve truncated bildirilir", async () => {
  setup(true, Array.from({ length: 5001 }, (_, i) => it({ orderId: `o${i}` })));
  const j = await (await get()).json();
  assert.equal(j.truncated, true);
  assert.equal(j.report.summary.orders, 5000);
});

test("hız sınırı: aynı IP dakikada 30 istekten sonra 429", async () => {
  setup(true, []);
  const same = () => route.GET(new Request("http://x/api/admin/complement-report", { headers: { "x-forwarded-for": "9.9.9.9" } }));
  let last;
  for (let i = 0; i < 31; i++) last = await same();
  assert.equal(last.status, 429);
});
