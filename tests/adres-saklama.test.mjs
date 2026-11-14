import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADDRESS_RETENTION_MS, isAddressBookExpired, purgeExpiredAddressBooks } from "../lib/address-retention.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-14T10:00:00Z");
const ago = (days) => new Date(NOW - days * DAY);
const OLD = 4 * 365; // 4 yıl

// Sahte depo: kullanıcılar, siparişler ve adresler bellekte; where yalnız bu kuralın kullandığı biçimde yorumlanır
function fakeDb(users, orders, addresses) {
  return {
    user: {
      findMany: async ({ where, take }) =>
        users
          .filter((u) => addresses.some((a) => a.userId === u.id) && u.createdAt < where.createdAt.lt && (u.lastLoginAt === null || u.lastLoginAt < where.OR[1].lastLoginAt.lt))
          .slice(0, take),
    },
    order: {
      groupBy: async ({ where }) =>
        where.userId.in.flatMap((id) => {
          const mine = orders.filter((o) => o.userId === id);
          return mine.length ? [{ userId: id, _max: { createdAt: new Date(Math.max(...mine.map((o) => o.createdAt.getTime()))) } }] : [];
        }),
    },
    address: {
      deleteMany: async ({ where }) => {
        const keep = addresses.filter((a) => !where.userId.in.includes(a.userId));
        const count = addresses.length - keep.length;
        addresses.splice(0, addresses.length, ...keep);
        return { count };
      },
    },
  };
}

test("saf kural: üçünün en yenisi 3 yıldan eskiyse süresi dolar; boş lastLoginAt'ta hesap tarihi kullanılır", () => {
  assert.equal(isAddressBookExpired({ lastLoginAt: null, createdAt: ago(OLD), lastOrderAt: null }, NOW), true);
  assert.equal(isAddressBookExpired({ lastLoginAt: null, createdAt: ago(100), lastOrderAt: null }, NOW), false);
  assert.equal(isAddressBookExpired({ lastLoginAt: ago(10), createdAt: ago(OLD), lastOrderAt: null }, NOW), false);
  assert.equal(isAddressBookExpired({ lastLoginAt: ago(OLD), createdAt: ago(OLD), lastOrderAt: ago(30) }, NOW), false);
  assert.equal(isAddressBookExpired({ lastLoginAt: ago(OLD), createdAt: ago(OLD + 5), lastOrderAt: ago(OLD) }, NOW), true);
  assert.equal(ADDRESS_RETENTION_MS, 3 * 365 * DAY);
});

test("silme: eski kullanıcının adresleri gider; yeni giriş/yeni sipariş/yeni hesap korunur; siparişlere dokunulmaz", async () => {
  const users = [
    { id: "eski", lastLoginAt: ago(OLD), createdAt: ago(OLD + 10) },
    { id: "yeni-giris", lastLoginAt: ago(20), createdAt: ago(OLD) },
    { id: "yeni-siparis", lastLoginAt: ago(OLD), createdAt: ago(OLD) },
    { id: "hic-girmemis-eski", lastLoginAt: null, createdAt: ago(OLD) },
    { id: "hic-girmemis-yeni", lastLoginAt: null, createdAt: ago(200) },
  ];
  const orders = [{ userId: "yeni-siparis", createdAt: ago(60) }, { userId: "eski", createdAt: ago(OLD) }];
  const addresses = users.flatMap((u) => [{ id: `${u.id}-1`, userId: u.id }, { id: `${u.id}-2`, userId: u.id }]);
  const n = await purgeExpiredAddressBooks(fakeDb(users, orders, addresses), NOW);
  assert.equal(n, 4); // eski + hic-girmemis-eski (2'şer adres)
  assert.deepEqual(new Set(addresses.map((a) => a.userId)), new Set(["yeni-giris", "yeni-siparis", "hic-girmemis-yeni"]));
  assert.equal(orders.length, 2);
});

test("aday yoksa silme çağrısı yapılmaz", async () => {
  const db = fakeDb([{ id: "a", lastLoginAt: ago(1), createdAt: ago(OLD) }], [], [{ id: "x", userId: "a" }]);
  db.address.deleteMany = async () => {
    throw new Error("çağrılmamalıydı");
  };
  assert.equal(await purgeExpiredAddressBooks(db, NOW), 0);
});

test("cron: adres adımı kendi try/catch'inde, günlüğe yalnız sayı yazar; vercel.json'da 2 cron", () => {
  const r = readFileSync(new URL("../app/api/cron/reminders/route.ts", import.meta.url), "utf8");
  assert.match(r, /purgeExpiredAddressBooks\(prisma\)/);
  assert.match(r, /\[cron\] adres defteri: \$\{addressesPurged\} adres silindi/);
  assert.equal(JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons.length, 2);
});
