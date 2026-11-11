import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAddress, updateAddress, deleteAddress, LIMIT_ERROR } from "../lib/address-store.ts";
import { MAX_ADDRESSES } from "../lib/address-book.ts";

// Bellek içi sahte AddressDb
function fakeDb() {
  const rows = [];
  let n = 0;
  const locked = [];
  const db = {
    rows,
    locked,
    lockUser: async (u) => void locked.push(u),
    list: async (u) => rows.filter((r) => r.userId === u).sort((a, b) => b.createdAt - a.createdAt),
    find: async (id, u) => rows.find((r) => r.id === id && r.userId === u) ?? null,
    create: async (d) => {
      const r = { ...d, id: `a${++n}`, createdAt: new Date(2026, 0, 1, 0, 0, n), updatedAt: new Date() };
      rows.push(r);
      return r;
    },
    update: async (id, d) => Object.assign(rows.find((r) => r.id === id), d),
    clearDefault: async (u, except) => rows.filter((r) => r.userId === u && r.id !== except).forEach((r) => (r.isDefault = false)),
    remove: async (id) => void rows.splice(rows.findIndex((r) => r.id === id), 1),
  };
  return db;
}
const input = (o = {}) => ({ title: "Ev", fullName: "Ayşe Yılmaz", phone: "0555 123 45 67", stateId: 34, stateName: "İSTANBUL", cityId: 425, cityName: "BEYOĞLU", address: "Şişhane Mah. Nazlı Hanım Sk. No:6", isDefault: false, ...o });
const defaults = (db, u) => db.rows.filter((r) => r.userId === u && r.isDefault);

test("ilk adres otomatik varsayılan; yeni varsayılan işaretlenince eskisi kalkar (tek varsayılan)", async () => {
  const db = fakeDb();
  const a = await createAddress(db, "u1", input());
  assert.equal(a.row.isDefault, true);
  const b = await createAddress(db, "u1", input({ title: "İş" }));
  assert.equal(b.row.isDefault, false);
  const c = await createAddress(db, "u1", input({ title: "Yazlık", isDefault: true }));
  assert.equal(c.row.isDefault, true);
  assert.deepEqual(defaults(db, "u1").map((r) => r.id), [c.row.id]);
  assert.ok(db.locked.every((u) => u === "u1") && db.locked.length === 3, "her yazma kullanıcı kilidiyle başlar");
});

test("en çok 10 adres; 11. reddedilir; başka kullanıcının sayısı etkilemez", async () => {
  const db = fakeDb();
  for (let i = 0; i < MAX_ADDRESSES; i++) assert.equal((await createAddress(db, "u1", input())).ok, true);
  const over = await createAddress(db, "u1", input());
  assert.equal(over.ok, false);
  assert.equal(over.status, 400);
  assert.equal(over.error, LIMIT_ERROR);
  assert.equal((await createAddress(db, "u2", input())).ok, true);
  assert.equal(defaults(db, "u1").length, 1);
});

test("IDOR: başkasının adresi güncellenemez/silinemez (404) ve değişmez", async () => {
  const db = fakeDb();
  const mine = (await createAddress(db, "u1", input())).row;
  const upd = await updateAddress(db, "u2", mine.id, input({ title: "Ele geçirildi" }));
  assert.equal(upd.ok, false);
  assert.equal(upd.status, 404);
  const del = await deleteAddress(db, "u2", mine.id);
  assert.equal(del.ok, false);
  assert.equal(del.status, 404);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].title, "Ev");
  assert.equal((await updateAddress(db, "u1", "yok", input())).status, 404);
});

test("güncelleme: varsayılan olmayan varsayılan yapılabilir; varsayılan adresin işareti kaldırılamaz", async () => {
  const db = fakeDb();
  const a = (await createAddress(db, "u1", input())).row; // varsayılan
  const b = (await createAddress(db, "u1", input({ title: "İş" }))).row;
  const r1 = await updateAddress(db, "u1", a.id, input({ isDefault: false }));
  assert.equal(r1.row.isDefault, true); // tek varsayılan kalır
  const r2 = await updateAddress(db, "u1", b.id, input({ title: "İş 2", isDefault: true }));
  assert.equal(r2.row.title, "İş 2");
  assert.deepEqual(defaults(db, "u1").map((r) => r.id), [b.id]);
});

test("silme: varsayılan silinirse en yeni kalan varsayılan olur; varsayılan olmayan silinince değişmez; son adres silinir", async () => {
  const db = fakeDb();
  const a = (await createAddress(db, "u1", input())).row; // varsayılan, en eski
  const b = (await createAddress(db, "u1", input({ title: "B" }))).row;
  const c = (await createAddress(db, "u1", input({ title: "C" }))).row; // en yeni
  assert.equal((await deleteAddress(db, "u1", b.id)).ok, true);
  assert.deepEqual(defaults(db, "u1").map((r) => r.id), [a.id]);
  assert.equal((await deleteAddress(db, "u1", a.id)).ok, true);
  assert.deepEqual(defaults(db, "u1").map((r) => r.id), [c.id]);
  assert.equal((await deleteAddress(db, "u1", c.id)).ok, true);
  assert.equal(db.rows.length, 0);
});

test("uçlar: giriş, hız sınırı, doğrulama, sahiplik ve genel yanıt (userId dönmez)", () => {
  const list = readFileSync(new URL("../app/api/user/addresses/route.ts", import.meta.url), "utf8");
  const one = readFileSync(new URL("../app/api/user/addresses/[id]/route.ts", import.meta.url), "utf8");
  for (const [name, s] of [["liste", list], ["tek", one]]) {
    assert.match(s, /getSessionUserId\(\)/, name);
    assert.match(s, /status: 401/, name);
    assert.match(s, /prisma\.\$transaction/, name);
  }
  assert.equal((list.match(/rateLimit\(req, "address-write"/g) ?? []).length, 1);
  assert.equal((one.match(/rateLimit\(req, "address-write"/g) ?? []).length, 2);
  assert.match(list, /cleanAddressInput\(body\)/);
  assert.match(one, /cleanAddressInput\(body\)/);
  assert.match(list, /where: \{ userId \}/); // yalnızca kendi adresleri
  const db = readFileSync(new URL("../lib/address-db.ts", import.meta.url), "utf8");
  assert.match(db, /find: \(id, userId\) => tx\.address\.findFirst\(\{ where: \{ id, userId \} \}\)/);
  assert.match(db, /FOR NO KEY UPDATE/); // A15: yabancı anahtar (sipariş) eklemeleriyle çakışmaz
  assert.ok(!/userId: r\.userId/.test(db), "yanıtta kullanıcı kimliği yok");
  // admin tarafında adres listesi gösterilmez
  for (const f of ["app/admin/page.tsx", "app/admin/siparis/[id]/page.tsx", "lib/activity.ts"]) {
    assert.ok(!/prisma\.address|api\/user\/addresses/.test(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")), f);
  }
});
