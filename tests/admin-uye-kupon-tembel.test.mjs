import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const customers = await import("../app/api/admin/customers/route.ts");
const liste = await import("../app/api/admin/coupons/liste/route.ts");
const lib = await import("../lib/admin-coupon-list.ts");

let calls;
const req = (q) => new Request(`http://x/api/admin/customers${q}`, { headers: { "x-forwarded-for": `ip-${Math.random()}` } });

function setupUsers(rows = []) {
  calls = [];
  globalThis.__fakePrisma = { user: { findMany: async (a) => (calls.push(a), rows) } };
}

test("yetkisiz: arama ve tüm kupon uçları 401, DB'ye gidilmez", async () => {
  globalThis.__adminAuthed = false;
  setupUsers();
  assert.equal((await customers.GET(req("?q=ab"))).status, 401);
  assert.equal((await liste.GET()).status, 401);
  assert.equal(calls.length, 0);
});

test("kısa/boş sorgu 400, DB'ye gidilmez", async () => {
  globalThis.__adminAuthed = true;
  setupUsers();
  for (const q of ["", "?q=", "?q=a", "?q=%20a%20"]) assert.equal((await customers.GET(req(q))).status, 400);
  assert.equal(calls.length, 0);
});

test("arama: take 10, startsWith + insensitive, yalnız ad/e-posta, misafir hariç", async () => {
  globalThis.__adminAuthed = true;
  setupUsers([{ name: "Ayşe", email: "ayse@x.com" }]);
  const res = await customers.GET(req("?q=ay"));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).customers, [{ name: "Ayşe", email: "ayse@x.com" }]);
  const a = calls[0];
  assert.equal(a.take, 10);
  assert.deepEqual(a.select, { name: true, email: true });
  assert.equal(a.where.role, "USER");
  assert.deepEqual(a.where.password, { not: "guest_checkout" });
  assert.deepEqual(a.where.NOT, { email: { contains: "+misafir", mode: "insensitive" } });
  assert.deepEqual(a.where.OR, [
    { email: { startsWith: "ay", mode: "insensitive" } },
    { name: { startsWith: "ay", mode: "insensitive" } },
  ]);
});

const rec = (id, active, day) => ({ id, code: id, discountPercent: 5, discountType: "PERCENT", discountAmount: null, minCartTotal: null, expiresAt: null, perUserLimit: null, maxUses: 1, usedCount: 0, userEmail: null, product: null, active, createdAt: new Date(Date.UTC(2026, 0, 1) + day * 864e5) });

function fakeDb(all) {
  const log = { many: [], count: 0 };
  const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
  return {
    log,
    db: {
      coupon: {
        findMany: async (a) => {
          log.many.push(a);
          let r = a.where?.active ? sorted.filter((c) => c.active) : sorted;
          return a.take ? r.slice(0, a.take) : r;
        },
        count: async () => (log.count++, all.length),
      },
    },
  };
}

test("kupon listesi: eski aktifler dahil, son 100 sınırı, rozet toplamı tüm kayıtlardan", async () => {
  // 150 kupon: en eski 5'i aktif, geri kalanı pasif; en yeni 100 pasif/aktif karışık
  const all = Array.from({ length: 150 }, (_, i) => rec(`c${i}`, i < 5 || i % 2 === 0, i));
  const { db, log } = fakeDb(all);
  const { coupons, total } = await lib.listCouponsForPage(db);
  assert.equal(total, 150);
  assert.equal(log.count, 1);
  const ids = new Set(coupons.map((c) => c.id));
  assert.equal(ids.size, coupons.length, "yinelenen kayıt yok");
  for (const c of all.filter((c) => c.active)) assert.ok(ids.has(c.id), `aktif ${c.id} listede`);
  for (const c of all.slice(50)) assert.ok(ids.has(c.id), `son 100'deki ${c.id} listede`);
  assert.ok(!ids.has("c7"), "eski pasif kupon listede değil");
  assert.ok(coupons.every((c, i) => i === 0 || coupons[i - 1].createdAt >= c.createdAt), "yeniden eskiye");
});

test("kupon listesi: 100'den az kayıtta sayım sorgusu yok, toplam = kayıt sayısı", async () => {
  const { db, log } = fakeDb([rec("a", true, 1), rec("b", false, 2)]);
  const { coupons, total } = await lib.listCouponsForPage(db);
  assert.equal(total, 2);
  assert.equal(coupons.length, 2);
  assert.equal(log.count, 0);
});

test("tümünü göster ucu: yetkili okur, sınırsız ve satır biçimi aynı", async () => {
  globalThis.__adminAuthed = true;
  const all = Array.from({ length: 130 }, (_, i) => rec(`k${i}`, false, i));
  const { db, log } = fakeDb(all);
  globalThis.__fakePrisma = db;
  const res = await liste.GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.coupons.length, 130);
  assert.equal(log.many[0].take, undefined);
  assert.deepEqual(Object.keys(body.coupons[0]).sort(), Object.keys(lib.toCouponRow(all[0])).sort());
  assert.equal(typeof body.coupons[0].createdAt, "string");
});
