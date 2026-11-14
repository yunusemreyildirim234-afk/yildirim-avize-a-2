import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runDailyCleanup, cleanupWhere } from "../lib/cleanup-rules.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-14T10:00:00Z");
const ago = (ms) => new Date(NOW - ms);

// Sahte depo: yalnız bu kuralların kullandığı where biçimlerini değerlendirir
function fakeDb({ codes, notifs, failCodes = false }) {
  return {
    codes, notifs,
    verificationCode: {
      deleteMany: async ({ where }) => {
        if (failCodes) throw new Error("kod tablosu yok");
        const keep = codes.filter((c) => !(c.expiresAt < where.expiresAt.lt));
        const count = codes.length - keep.length;
        codes.splice(0, codes.length, ...keep);
        return { count };
      },
    },
    notification: {
      deleteMany: async ({ where }) => {
        const del = (n) => n.read === where.read && n.createdAt < where.createdAt.lt;
        const keep = notifs.filter((n) => !del(n));
        const count = notifs.length - keep.length;
        notifs.splice(0, notifs.length, ...keep);
        return { count };
      },
    },
  };
}

test("kodlar: 1 günden eski süresi geçmiş silinir; yeni ve süresi dolmamış kalır", async () => {
  const db = fakeDb({
    codes: [
      { id: "eski", expiresAt: ago(2 * DAY) },
      { id: "dun-doldu", expiresAt: ago(DAY + 1000) },
      { id: "bugun-doldu", expiresAt: ago(60 * 60_000) },
      { id: "gecerli", expiresAt: new Date(NOW + 10 * 60_000) },
    ],
    notifs: [],
  });
  const r = await runDailyCleanup(db, NOW);
  assert.equal(r.codes, 2);
  assert.deepEqual(db.codes.map((c) => c.id), ["bugun-doldu", "gecerli"]);
});

test("bildirimler: yalnız okunmuş ve 90 günden eski silinir; okunmamış hiç silinmez", async () => {
  const db = fakeDb({
    codes: [],
    notifs: [
      { id: "okunmus-eski", read: true, createdAt: ago(91 * DAY) },
      { id: "okunmamis-eski", read: false, createdAt: ago(400 * DAY) },
      { id: "okunmus-yeni", read: true, createdAt: ago(10 * DAY) },
      { id: "okunmamis-yeni", read: false, createdAt: ago(1 * DAY) },
      { id: "sinirda", read: true, createdAt: ago(89 * DAY) },
    ],
  });
  const r = await runDailyCleanup(db, NOW);
  assert.equal(r.notifications, 1);
  assert.deepEqual(db.notifs.map((n) => n.id).sort(), ["okunmamis-eski", "okunmamis-yeni", "okunmus-yeni", "sinirda"].sort());
});

test("bir temizlik hata verirse diğeri yine çalışır", async () => {
  const db = fakeDb({ codes: [{ id: "a", expiresAt: ago(5 * DAY) }], notifs: [{ id: "n", read: true, createdAt: ago(100 * DAY) }], failCodes: true });
  const r = await runDailyCleanup(db, NOW);
  assert.equal(r.notifications, 1);
  assert.equal(r.codes, 0);
  assert.equal(r.errors.length, 1);
});

test("where kuralları: tarih sınırları ve okundu koşulu", () => {
  const w = cleanupWhere(NOW);
  assert.equal(w.codes.expiresAt.lt.getTime(), NOW - DAY);
  assert.equal(w.notifications.read, true);
  assert.equal(w.notifications.createdAt.lt.getTime(), NOW - 90 * DAY);
});

test("uç CRON_SECRET ile korunur; vercel.json'a günlük görev eklenmiş, eskiler aynı", () => {
  const route = readFileSync(new URL("../app/api/cron/cleanup/route.ts", import.meta.url), "utf8");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /safeCompare\(/);
  assert.ok(route.indexOf("status: 401") < route.indexOf("runDailyCleanup(prisma)"));
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const paths = cfg.crons.map((c) => `${c.path} ${c.schedule}`);
  assert.ok(paths.includes("/api/cron/reminders 0 9 * * *"));
  assert.ok(paths.includes("/api/cron/sync-shipments 0 10 * * *"));
  assert.ok(paths.includes("/api/cron/cleanup 30 3 * * *"));
});
