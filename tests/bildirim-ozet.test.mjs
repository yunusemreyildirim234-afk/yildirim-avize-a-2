import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getNotificationSummary, summarizeGroups, summaryChanged } from "../lib/notification-summary.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const D = (s) => new Date(s);

// Sahte depo: satırlar { owner, read, createdAt }; groupBy, sahiplik filtresini (where.owner) uygular ve read'e göre gruplar.
function fakeStore(rows) {
  return {
    async groupBy(where) {
      const mine = rows.filter((r) => r.owner === where.owner);
      return [true, false]
        .map((read) => {
          const g = mine.filter((r) => r.read === read);
          return g.length ? { read, count: g.length, latest: new Date(Math.max(...g.map((r) => r.createdAt.getTime()))) } : null;
        })
        .filter(Boolean);
    },
  };
}

const rows = [
  { owner: "ayse", read: false, createdAt: D("2026-11-10T10:00:00Z") },
  { owner: "ayse", read: false, createdAt: D("2026-11-11T09:00:00Z") },
  { owner: "ayse", read: true, createdAt: D("2026-11-12T08:00:00Z") },
  { owner: "baska", read: false, createdAt: D("2026-11-14T12:00:00Z") },
  { owner: "baska", read: false, createdAt: D("2026-11-14T13:00:00Z") },
];

test("özet: okunmamış sayısı ve en yeni tarih (okunmuş olan dahil)", async () => {
  assert.deepEqual(await getNotificationSummary(fakeStore(rows), { owner: "ayse" }), { unread: 2, latest: "2026-11-12T08:00:00.000Z" });
});

test("başkasının bildirimi sayılmaz ve tarihini etkilemez", async () => {
  const s = await getNotificationSummary(fakeStore(rows), { owner: "ayse" });
  assert.equal(s.unread, 2);
  assert.ok(s.latest < "2026-11-14");
  assert.deepEqual(await getNotificationSummary(fakeStore(rows), { owner: "yok" }), { unread: 0, latest: null });
});

test("boş grup listesi: 0 ve null", () => {
  assert.deepEqual(summarizeGroups([]), { unread: 0, latest: null });
});

test("değişim: yeni bildirim düşünce newItems; yalnız sayı azalınca badge", () => {
  const a = { unread: 2, latest: "2026-11-12T08:00:00.000Z" };
  assert.deepEqual(summaryChanged(a, { unread: 3, latest: "2026-11-14T08:00:00.000Z" }), { newItems: true, badge: true });
  assert.deepEqual(summaryChanged(a, { unread: 0, latest: a.latest }), { newItems: false, badge: true });
  assert.deepEqual(summaryChanged(a, a), { newItems: false, badge: false });
  assert.deepEqual(summaryChanged({ unread: 0, latest: null }, { unread: 1, latest: "2026-11-14T08:00:00.000Z" }), { newItems: true, badge: true });
  assert.deepEqual(summaryChanged(a, { unread: 0, latest: null }), { newItems: false, badge: true }); // hepsi silindi
});

test("uçlar: özet modu liste döndürmez, sahiplik ve yönetici denetimi yerinde", () => {
  const u = read("app/api/notifications/route.ts");
  assert.match(u, /searchParams\.get\("ozet"\) === "1"/);
  assert.match(u, /groupBy\(\{ by: \["read"\], where,/);
  assert.match(u, /const where = await scope\(req\);/); // özetten önce aynı kapsam
  assert.ok(u.indexOf("groupBy") > u.indexOf("const where = await scope(req)"));
  const a = read("app/api/admin/notifications/route.ts");
  assert.ok(a.indexOf("adminGuard()") < a.indexOf('"ozet"'));
  assert.match(a, /return NextResponse\.json\(\{ orders: o\._count\._all, messages: m\._count\._all, latest \}\)/);
});

test("istemci: zil ve AdminLiveAlerts aynı özet adresini paylaşır; müşteride zamanlayıcı yok, yönetimde 180 sn", () => {
  const b = read("components/NotificationBell.tsx");
  const l = read("components/AdminLiveAlerts.tsx");
  assert.match(b, /\/api\/notifications\$\{scopeQs\}&ozet=1/);
  assert.match(l, /"\/api\/notifications\?scope=admin&ozet=1"/);
  assert.match(b, /isAdminScope \? 180_000 : 0/);
  assert.match(l, /180_000/);
  assert.doesNotMatch(b, /setInterval/);
  assert.doesNotMatch(l, /setInterval|\/api\/admin\/notifications/);
  assert.match(read("lib/notification-poll.ts"), /document\.hidden/);
});
